const crypto = require('node:crypto');

const SECRET_KEY = process.env.WEBPOS_SECRET || 'webpos-enterprise-multitenant-secret-2026-key';

function generateId() {
  return crypto.randomUUID();
}

function hashPassword(password, salt = null) {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.pbkdf2Sync(String(password), actualSalt, 10000, 64, 'sha256').toString('hex');
  return `${actualSalt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  const candidate = hashPassword(password, salt).split(':')[1];
  return crypto.timingSafeEqual(Buffer.from(originalHash, 'hex'), Buffer.from(candidate, 'hex'));
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken) + SECRET_KEY).digest('hex');
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = 'WP-';
  for (let i = 0; i < 8; i++) {
    out += chars[crypto.randomInt(0, chars.length)];
  }
  return out;
}

function generateResetCode() {
  return String(crypto.randomInt(100000, 999999));
}

function generateRawToken() {
  return crypto.randomBytes(24).toString('hex');
}

module.exports = {
  generateId,
  hashPassword,
  verifyPassword,
  hashToken,
  generateTempPassword,
  generateResetCode,
  generateRawToken
};
