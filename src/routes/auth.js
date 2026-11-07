const { getDb } = require('../../database/db');
const {
  generateId,
  hashPassword,
  verifyPassword,
  hashToken,
  generateResetCode,
  generateRawToken
} = require('../utils/crypto');

function buildSessionPayload(db, user, requestedFiscalYear = null, requestedStoreId = null) {
  let tenant = null;
  let fiscalYears = [];
  let stores = [];
  let activeFiscalYear = requestedFiscalYear || 2026;
  let activeStoreId = requestedStoreId || null;

  if (user.tenant_id) {
    tenant = db.prepare(`SELECT * FROM tenants WHERE id = ?`).get(user.tenant_id);
    fiscalYears = db.prepare(`SELECT * FROM fiscal_years WHERE tenant_id = ? ORDER BY year DESC`).all(user.tenant_id);
    stores = db.prepare(`SELECT * FROM stores WHERE tenant_id = ? AND is_active = 1 ORDER BY code ASC`).all(user.tenant_id);

    if (!requestedFiscalYear && fiscalYears.length > 0) {
      const activeFy = fiscalYears.find(f => f.is_active === 1) || fiscalYears[0];
      activeFiscalYear = activeFy.year;
    }
    if (!activeStoreId && stores.length > 0) {
      activeStoreId = stores[0].id;
    }
  }

  return {
    user: {
      id: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      mustChangePassword: Boolean(user.must_change_password)
    },
    tenant,
    fiscalYears,
    stores,
    activeFiscalYear: Number(activeFiscalYear),
    activeStoreId
  };
}

function handleLogin(body) {
  const db = getDb();
  const identifier = String(body.identifier || body.email || body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  const requestedYear = body.fiscalYear ? Number(body.fiscalYear) : null;

  if (!identifier || !password) {
    return { status: 400, data: { error: 'Unesite email/korisničko ime i lozinku.' } };
  }

  const user = db.prepare(`
    SELECT * FROM users
    WHERE LOWER(email) = ? OR LOWER(username) = ?
    LIMIT 1
  `).get(identifier, identifier);

  if (!user || !verifyPassword(password, user.password_hash)) {
    return { status: 401, data: { error: 'Pogrešno korisničko ime/email ili lozinka.' } };
  }

  if (!user.is_active) {
    return { status: 403, data: { error: 'Korisnički nalog je deaktiviran.' } };
  }

  if (user.tenant_id) {
    const tenant = db.prepare(`SELECT status FROM tenants WHERE id = ?`).get(user.tenant_id);
    if (!tenant || tenant.status !== 'ACTIVE') {
      return { status: 403, data: { error: 'Tenant nalog nije aktivan. Kontaktirajte administratora sistema.' } };
    }
  }

  const context = buildSessionPayload(db, user, requestedYear, null);
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  db.prepare(`
    INSERT INTO user_sessions (id, user_id, tenant_id, fiscal_year, active_store_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    generateId(),
    user.id,
    user.tenant_id,
    context.activeFiscalYear,
    context.activeStoreId,
    tokenHash,
    expiresAt
  );

  db.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`).run(user.id);

  return {
    status: 200,
    data: {
      token: rawToken,
      ...context
    }
  };
}

function getAuthenticatedSession(req) {
  const authHeader = req.headers['authorization'] || '';
  const rawToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!rawToken) return null;

  const db = getDb();
  const tokenHash = hashToken(rawToken);
  const session = db.prepare(`
    SELECT * FROM user_sessions WHERE token_hash = ? LIMIT 1
  `).get(tokenHash);

  if (!session) return null;
  const user = db.prepare(`SELECT * FROM users WHERE id = ? AND is_active = 1`).get(session.user_id);
  if (!user) return null;

  return {
    session,
    user,
    context: buildSessionPayload(db, user, session.fiscal_year, session.active_store_id)
  };
}

function handleSwitchContext(auth, body) {
  const db = getDb();
  const newYear = body.fiscalYear ? Number(body.fiscalYear) : auth.session.fiscal_year;
  const newStoreId = body.storeId || auth.session.active_store_id;

  db.prepare(`
    UPDATE user_sessions SET fiscal_year = ?, active_store_id = ? WHERE id = ?
  `).run(newYear, newStoreId, auth.session.id);

  return {
    status: 200,
    data: buildSessionPayload(db, auth.user, newYear, newStoreId)
  };
}

/**
 * ZABORAVLJENA LOZINKA — Korak 1: Zahtjev za reset lozinke
 */
function handleForgotPassword(body) {
  const db = getDb();
  const identifier = String(body.email || body.identifier || '').trim().toLowerCase();
  if (!identifier) {
    return { status: 400, data: { error: 'Unesite Vašu email adresu ili korisničko ime.' } };
  }

  const user = db.prepare(`
    SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ? LIMIT 1
  `).get(identifier, identifier);

  if (!user) {
    return { status: 404, data: { error: 'Korisnički nalog sa navedenom email adresom nije pronađen.' } };
  }

  const rawResetToken = generateRawToken();
  const resetCode = generateResetCode();
  const tokenHash = hashToken(rawResetToken);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO password_reset_tokens (id, user_id, tenant_id, email, token_hash, reset_code, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(generateId(), user.id, user.tenant_id, user.email, tokenHash, resetCode, expiresAt);

  const subject = 'WebPOS — Zahtjev za oporavak zaboravljene lozinke';
  const bodyText = `Poštovani ${user.full_name},\n\nPrimili smo zahtjev za resetovanje zaboravljene lozinke za Vaš nalog (${user.email}).\nVaš sigurnosni 6-cifreni kod za reset lozinke glasi: ${resetCode}\nKod važi 30 minuta.`;

  db.prepare(`
    INSERT INTO email_notifications_outbox (id, tenant_id, recipient_email, recipient_name, email_type, subject, body_text, metadata_json, status)
    VALUES (?, ?, ?, ?, 'PASSWORD_RESET_LINK', ?, ?, ?, 'SENT')
  `).run(
    generateId(),
    user.tenant_id,
    user.email,
    user.full_name,
    subject,
    bodyText,
    JSON.stringify({ resetCode, resetToken: rawResetToken, expiresAt })
  );

  return {
    status: 200,
    data: {
      message: `Uputstvo i sigurnosni kod za reset lozinke su poslani na ${user.email}.`,
      email: user.email,
      // Vraćamo simulirani sadržaj poslanog emaila radi trenutne provjere i testiranja u UI
      simulatedEmailPreview: {
        to: user.email,
        subject,
        resetCode,
        expiresAt
      }
    }
  };
}

/**
 * ZABORAVLJENA LOZINKA — Korak 2: Potvrda koda/tokena i postavljanje nove lozinke
 */
function handleResetPassword(body) {
  const db = getDb();
  const email = String(body.email || '').trim().toLowerCase();
  const resetCode = String(body.resetCode || '').trim();
  const newPassword = String(body.newPassword || '');

  if (!email || !resetCode || newPassword.length < 6) {
    return {
      status: 400,
      data: { error: 'Unesite email, 6-cifreni sigurnosni kod i novu lozinku (najmanje 6 znakova).' }
    };
  }

  const tokenRow = db.prepare(`
    SELECT * FROM password_reset_tokens
    WHERE LOWER(email) = ? AND reset_code = ? AND used_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `).get(email, resetCode);

  if (!tokenRow) {
    return { status: 400, data: { error: 'Neispravan ili već iskorišten sigurnosni kod za oporavak lozinke.' } };
  }

  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return { status: 400, data: { error: 'Sigurnosni kod je istekao. Zatražite novi kod.' } };
  }

  const newHash = hashPassword(newPassword);
  db.prepare(`
    UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?
  `).run(newHash, tokenRow.user_id);

  db.prepare(`
    UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?
  `).run(tokenRow.id);

  return {
    status: 200,
    data: {
      message: 'Vaša lozinka je uspješno promijenjena! Sada se možete prijaviti sa novom lozinkom.'
    }
  };
}

module.exports = {
  handleLogin,
  getAuthenticatedSession,
  handleSwitchContext,
  handleForgotPassword,
  handleResetPassword
};
