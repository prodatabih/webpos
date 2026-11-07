let authToken = localStorage.getItem('webpos_token') || '';
let currentSession = null;
let superAdminData = { tenants: [], sentEmails: [] };
let tenantData = {
  tenant: null,
  fiscalYear: 2026,
  fiscalYears: [],
  stores: [],
  terminals: [],
  partners: [],
  items: [],
  documents: [],
  receipts: []
};

let openTabs = [];
let activeTabId = '';
let posCart = [];
let activeTerminalId = '';

// POMOĆNA FUNKCIJA ZA API POZIVE
async function apiCall(path, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Greška pri komunikaciji sa serverom.');
  }
  return data;
}

function showAuthAlert(msg, isSuccess = false) {
  const box = document.getElementById('authAlertBox');
  box.textContent = msg;
  box.style.background = isSuccess ? 'var(--emerald-bg)' : 'var(--danger-bg)';
  box.style.color = isSuccess ? 'var(--emerald)' : 'var(--danger)';
  box.style.border = `1px solid ${isSuccess ? 'var(--emerald)' : 'var(--danger)'}`;
  box.classList.remove('hidden');
}

function hideAuthAlert() {
  document.getElementById('authAlertBox').classList.add('hidden');
}

function showAppToast(msg) {
  const banner = document.getElementById('appToastBanner');
  document.getElementById('appToastText').textContent = msg;
  banner.classList.remove('hidden');
}

function toggleTheme() {
  document.body.classList.toggle('theme-light');
}

// ============================================================================
// 1. PRIJAVA I ZABORAVLJENA LOZINKA
// ============================================================================
function showForgotPasswordView() {
  hideAuthAlert();
  document.getElementById('loginFormContainer').classList.add('hidden');
  document.getElementById('forgotFormContainer').classList.remove('hidden');
}

function showLoginView() {
  hideAuthAlert();
  document.getElementById('forgotFormContainer').classList.add('hidden');
  document.getElementById('loginFormContainer').classList.remove('hidden');
}

async function quickLogin(identifier, password, fiscalYear) {
  document.getElementById('loginIdentifier').value = identifier;
  document.getElementById('loginPassword').value = password;
  if (fiscalYear) document.getElementById('loginFiscalYear').value = String(fiscalYear);
  await submitLogin();
}

async function submitLogin() {
  hideAuthAlert();
  try {
    const identifier = document.getElementById('loginIdentifier').value.trim();
    const password = document.getElementById('loginPassword').value;
    const fiscalYear = Number(document.getElementById('loginFiscalYear').value || 2026);

    const res = await apiCall('/api/auth/login', 'POST', { identifier, password, fiscalYear });
    authToken = res.token;
    localStorage.setItem('webpos_token', authToken);
    currentSession = res;
    await enterApplicationShell();
  } catch (err) {
    showAuthAlert(err.message, false);
  }
}

async function requestPasswordResetCode() {
  hideAuthAlert();
  try {
    const email = document.getElementById('forgotEmailInput').value.trim();
    const res = await apiCall('/api/auth/forgot-password', 'POST', { email });
    const banner = document.getElementById('resetCodePreviewBanner');
    document.getElementById('previewResetCodeVal').textContent = res.simulatedEmailPreview.resetCode;
    document.getElementById('resetCodeInput').value = res.simulatedEmailPreview.resetCode;
    banner.classList.remove('hidden');
    showAuthAlert(res.message, true);
  } catch (err) {
    showAuthAlert(err.message, false);
  }
}

async function submitPasswordReset() {
  hideAuthAlert();
  try {
    const email = document.getElementById('forgotEmailInput').value.trim();
    const resetCode = document.getElementById('resetCodeInput').value.trim();
    const newPassword = document.getElementById('resetNewPasswordInput').value;

    const res = await apiCall('/api/auth/reset-password', 'POST', { email, resetCode, newPassword });
    showLoginView();
    document.getElementById('loginIdentifier').value = email;
    document.getElementById('loginPassword').value = newPassword;
    showAuthAlert(res.message, true);
  } catch (err) {
    showAuthAlert(err.message, false);
  }
}

function logoutUser() {
  authToken = '';
  currentSession = null;
  localStorage.removeItem('webpos_token');
  document.getElementById('mainAppShell').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
  showLoginView();
}

// ============================================================================
// 2. ULAZAK U GLAVNU FORMU (SUPER-ADMIN ILI TENANT MAIN FORM)
// ============================================================================
async function enterApplicationShell() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('mainAppShell').classList.remove('hidden');

  document.getElementById('footerUserName').textContent = `${currentSession.user.fullName} (${currentSession.user.role})`;
  document.getElementById('footerUserEmail').textContent = currentSession.user.email;

  if (currentSession.user.role === 'SUPER_ADMIN') {
    document.getElementById('sidebarTenantTitle').textContent = 'WebPOS Super-Admin';
    document.getElementById('sidebarRoleSubtitle').textContent = 'Upravljanje Tenantima & Baza';
    document.getElementById('tenantContextSelectors').classList.add('hidden');

    openTabs = [
      { id: 'super-admin', title: 'Super-Admin: Tenanti & Slanje Računa' },
      { id: 'main-launcher', title: 'Glavna Forma (Pregled Registara)' }
    ];
    activeTabId = 'super-admin';
    await loadSuperAdminData();
    await loadTenantBootstrapData();
  } else {
    document.getElementById('sidebarTenantTitle').textContent = currentSession.tenant ? currentSession.tenant.name : 'WebPOS Tenant';
    document.getElementById('sidebarRoleSubtitle').textContent = `${currentSession.tenant ? currentSession.tenant.code : ''} · Multi-Year Baza`;
    document.getElementById('tenantContextSelectors').classList.remove('hidden');

    openTabs = [
      { id: 'main-launcher', title: 'Glavna Forma (Poziv Registara)' },
      { id: 'reg-items', title: 'Registar Artikala (F2)' },
      { id: 'pos', title: 'POS Kasa (F1)' }
    ];
    activeTabId = 'main-launcher';
    await loadTenantBootstrapData();
  }

  renderSidebarNavigation();
  renderTabsStrip();
  renderActiveWorkspace();
}

async function loadSuperAdminData() {
  superAdminData = await apiCall('/api/super-admin/overview');
}

async function loadTenantBootstrapData() {
  const fy = currentSession.activeFiscalYear || 2026;
  tenantData = await apiCall(`/api/tenant/bootstrap?fiscalYear=${fy}`);

  // Popuni selektore poslovnih godina i prodajnih objekata
  const fySelect = document.getElementById('activeFiscalYearSelect');
  if (fySelect && tenantData.fiscalYears) {
    fySelect.innerHTML = tenantData.fiscalYears.map(f => `
      <option value="${f.year}" ${Number(f.year) === Number(tenantData.fiscalYear) ? 'selected' : ''}>
        ${f.year}. godina ${f.is_closed ? '(Zaključena)' : '(Aktivna)'}
      </option>
    `).join('');
  }

  const stSelect = document.getElementById('activeStoreSelect');
  if (stSelect && tenantData.stores) {
    if (!currentSession.activeStoreId && tenantData.stores.length > 0) {
      currentSession.activeStoreId = tenantData.stores[0].id;
    }
    stSelect.innerHTML = tenantData.stores.map(s => `
      <option value="${s.id}" ${s.id === currentSession.activeStoreId ? 'selected' : ''}>
        ${s.code} · ${s.name}
      </option>
    `).join('');
  }

  if (tenantData.terminals && tenantData.terminals.length > 0 && !activeTerminalId) {
    activeTerminalId = tenantData.terminals[0].id;
  }
}

async function switchFiscalYearOrStore() {
  const newYear = Number(document.getElementById('activeFiscalYearSelect').value);
  const newStoreId = document.getElementById('activeStoreSelect').value;
  currentSession.activeFiscalYear = newYear;
  currentSession.activeStoreId = newStoreId;

  await apiCall('/api/auth/switch-context', 'POST', { fiscalYear: newYear, storeId: newStoreId });
  await loadTenantBootstrapData();
  renderActiveWorkspace();
  showAppToast(`Prebačen kontekst u istoj bazi: Poslovna ${newYear}. godina · Objekat ažuriran.`);
}

// ============================================================================
// 3. NAVIGACIJA GLAVNE FORME (SIDEBAR & RADNI TABOVI)
// ============================================================================
function renderSidebarNavigation() {
  const nav = document.getElementById('sidebarNavContainer');
  const isSuper = currentSession && currentSession.user.role === 'SUPER_ADMIN';

  nav.innerHTML = `
    ${isSuper ? `
      <div class="nav-section-title">
        <span>Vlasnik Platforme (Sistem)</span>
        <span class="badge badge-amber">SUPER</span>
      </div>
      <button onclick="openWorkspaceTab('super-admin', 'Super-Admin: Tenanti & Slanje Računa')" class="nav-btn ${activeTabId === 'super-admin' ? 'active' : ''}">
        <span>Tenanti &amp; Slanje Admin Računa</span>
        <span class="kbd-badge">Admin</span>
      </button>
    ` : ''}

    <div class="nav-section-title">
      <span>Glavna Forma</span>
    </div>
    <button onclick="openWorkspaceTab('main-launcher', 'Glavna Forma (Poziv Registara)')" class="nav-btn ${activeTabId === 'main-launcher' ? 'active' : ''}">
      <span>Glavna Forma (Lanser Registara)</span>
      <span class="kbd-badge">Home</span>
    </button>
    <button onclick="openWorkspaceTab('pos', 'POS Kasa (Terminal)')" class="nav-btn ${activeTabId === 'pos' ? 'active' : ''}">
      <span>POS Kasa (Maloprodaja)</span>
      <span class="kbd-badge">F1</span>
    </button>

    <div class="nav-section-title">
      <span>Registri / Šifarnici</span>
      <span style="color: #3b82f6;">Poziv</span>
    </div>
    <button onclick="openWorkspaceTab('reg-items', 'Registar Artikala (F2)')" class="nav-btn ${activeTabId === 'reg-items' ? 'active' : ''}">
      <span>Registar artikala &amp; barkodova</span>
      <span class="kbd-badge">F2</span>
    </button>
    <button onclick="openWorkspaceTab('reg-prices', 'Cjenovnici po objektima (F3)')" class="nav-btn ${activeTabId === 'reg-prices' ? 'active' : ''}">
      <span>Cjenovnici po objektima</span>
      <span class="kbd-badge">F3</span>
    </button>
    <button onclick="openWorkspaceTab('reg-partners', 'Registar Partnera (F4)')" class="nav-btn ${activeTabId === 'reg-partners' ? 'active' : ''}">
      <span>Registar partnera (Komitenti)</span>
      <span class="kbd-badge">F4</span>
    </button>
    <button onclick="openWorkspaceTab('reg-stores', 'Registar Objekata i Kasa')" class="nav-btn ${activeTabId === 'reg-stores' ? 'active' : ''}">
      <span>Registar objekata &amp; kasa</span>
    </button>
    <button onclick="openWorkspaceTab('reg-labels', 'Šabloni Deklaracija i Cijena')" class="nav-btn ${activeTabId === 'reg-labels' ? 'active' : ''}">
      <span>Šabloni cijena za police</span>
    </button>

    <div class="nav-section-title">
      <span>Robni Dokumenti (${tenantData.fiscalYear}. god.)</span>
    </div>
    <button onclick="openWorkspaceTab('doc-calc', 'Ulazne Kalkulacije')" class="nav-btn ${activeTabId === 'doc-calc' ? 'active' : ''}">
      <span>Ulazne kalkulacije (Prijem)</span>
    </button>
    <button onclick="openWorkspaceTab('doc-transfer', 'Prelokacije između objekata')" class="nav-btn ${activeTabId === 'doc-transfer' ? 'active' : ''}">
      <span>Prelokacije (Međuskladišnice)</span>
    </button>
  `;
}

function openWorkspaceTab(id, title) {
  if (!openTabs.find(t => t.id === id)) {
    openTabs.push({ id, title });
  }
  activeTabId = id;
  renderSidebarNavigation();
  renderTabsStrip();
  renderActiveWorkspace();
}

function closeWorkspaceTab(event, id) {
  event.stopPropagation();
  if (openTabs.length <= 1) return;
  openTabs = openTabs.filter(t => t.id !== id);
  if (activeTabId === id) {
    activeTabId = openTabs[openTabs.length - 1].id;
  }
  renderSidebarNavigation();
  renderTabsStrip();
  renderActiveWorkspace();
}

function renderTabsStrip() {
  const strip = document.getElementById('workspaceTabsStrip');
  strip.innerHTML = openTabs.map(t => `
    <div onclick="openWorkspaceTab('${t.id}', '${t.title}')" class="workspace-tab ${t.id === activeTabId ? 'active' : ''}">
      <span>${t.title}</span>
      ${openTabs.length > 1 ? `<span onclick="closeWorkspaceTab(event, '${t.id}')" style="opacity:0.7;">✕</span>` : ''}
    </div>
  `).join('');
}

// ============================================================================
// 4. RENDEROVANJE SADRŽAJA AKTIVNOG PROZORA
// ============================================================================
function getCurrentStoreObj() {
  return tenantData.stores.find(s => s.id === currentSession.activeStoreId) || tenantData.stores[0] || { id: '', code: 'PJ-01', name: 'Market' };
}

function renderActiveWorkspace() {
  const body = document.getElementById('workspaceBody');

  // --------------------------------------------------------------------------
  // A) SUPER-ADMIN KONZOLA: KREIRANJE TENANTA I SLANJE ADMINISTRATORSKOG RAČUNA
  // --------------------------------------------------------------------------
  if (activeTabId === 'super-admin') {
    body.innerHTML = `
      <div style="max-width: 1220px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">

        <!-- Zaglavlje Super-Admin portala -->
        <div class="card" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;">
          <div>
            <span class="badge badge-amber">SISTEMSKI SUPER-ADMINISTRATOR</span>
            <h1 style="font-size: 18px; font-weight: 800; margin-top: 4px;">Multi-Tenant Upravljanje i Slanje Administratorskih Računa Tenantima</h1>
            <p style="color: var(--text-muted); font-size: 12.5px;">
              Svi tenanti i sve njihove poslovne godine (2025, 2026, 2027...) nalaze se u jednoj bazi podataka sa potpunom izolacijom putem <code class="mono">tenant_id</code> i <code class="mono">fiscal_year</code> ključeva.
            </p>
          </div>
          <div style="display: flex; gap: 10px;">
            <div style="padding: 8px 14px; border-radius: 10px; background: var(--bg-input); border: 1px solid var(--border-subtle); text-align: center;">
              <div style="font-size: 11px; color: var(--text-muted);">Aktivnih tenanata</div>
              <div class="mono" style="font-size: 16px; font-weight: 800; color: var(--emerald);">${superAdminData.tenants.length}</div>
            </div>
            <div style="padding: 8px 14px; border-radius: 10px; background: var(--bg-input); border: 1px solid var(--border-subtle); text-align: center;">
              <div style="font-size: 11px; color: var(--text-muted);">Poslanih Admin naloga</div>
              <div class="mono" style="font-size: 16px; font-weight: 800; color: var(--sky);">${superAdminData.sentEmails.length}</div>
            </div>
          </div>
        </div>

        <!-- GLAVNA FORMA ZA SUPER-ADMINA: KREIRAJ TENANTA I POŠALJI MU ADMINISTRATORSKI RAČUN -->
        <div class="card" style="border: 2px solid rgba(16, 185, 129, 0.45);">
          <div style="margin-bottom: 14px;">
            <span class="badge badge-emerald">NOVI TENANT ONBOARDING</span>
            <h2 style="font-size: 15.5px; font-weight: 800; margin-top: 4px;">Kreiraj Novog Tenanta i Pošalji Administratorski Račun za Njega</h2>
            <p style="font-size: 12px; color: var(--text-muted);">
              Unesite podatke o novoj firmi (tenantu) i email njenog administratora. Sistem automatski inicijalizuje poslovnu godinu, početni prodajni objekat i kasu, te šalje pristupne podatke administratoru tenanta.
            </p>
          </div>

          <div class="grid-3">
            <div class="form-group">
              <label class="form-label">Naziv kompanije (Tenanta) *</label>
              <input id="saCompanyName" type="text" class="form-input" placeholder="npr. Tropik Marketi d.o.o." value="Bingo Plus Market d.o.o." />
            </div>
            <div class="form-group">
              <label class="form-label">JIB / PIB (Poreski broj) *</label>
              <input id="saTaxNumber" type="text" class="form-input mono" placeholder="npr. 4209988770001" value="4209988770001" />
            </div>
            <div class="form-group">
              <label class="form-label">PDV broj i Grad</label>
              <div style="display: flex; gap: 8px;">
                <input id="saVatNumber" type="text" class="form-input mono" placeholder="PDV broj" value="209988770001" />
                <input id="saCity" type="text" class="form-input" placeholder="Grad" value="Tuzla" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Ime i prezime Administratora Tenanta *</label>
              <input id="saAdminName" type="text" class="form-input" placeholder="npr. Edin Džeko" value="Damir Begović" />
            </div>
            <div class="form-group">
              <label class="form-label">Email Administratora (za slanje računa) *</label>
              <input id="saAdminEmail" type="email" class="form-input" placeholder="npr. admin@bingoplus.ba" value="admin@bingoplus.ba" />
            </div>
            <div class="form-group">
              <label class="form-label">Početna lozinka i Poslovna godina</label>
              <div style="display: flex; gap: 8px;">
                <input id="saAdminPass" type="text" class="form-input mono" placeholder="Auto ili upišite" value="Bingo2026!" />
                <input id="saInitialYear" type="number" class="form-input mono" style="width: 95px;" value="2026" />
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: 6px;">
            <button onclick="submitCreateTenantAndSendAccount()" class="btn btn-emerald" style="padding: 11px 20px; font-size: 13px;">
              ✓ Kreiraj Tenanta u Bazi &amp; Pošalji Administratorski Račun
            </button>
          </div>
        </div>

        <!-- TABELA SVIH TENANATA U JEDNOJ BAZI I NJIHOVIH POSLOVNIH GODINA -->
        <div class="card">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <div>
              <h3 style="font-size: 14.5px; font-weight: 800;">Registrovani Tenanti i Poslovne Godine (Sve u jednoj bazi)</h3>
              <p style="font-size: 12px; color: var(--text-muted);">Za svakog tenanta možete otvoriti novu poslovnu godinu u istoj bazi sa automatskim prenosom šifarnika i stanja.</p>
            </div>
          </div>

          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Oznaka</th>
                  <th>Naziv Tenanta (Kompanije)</th>
                  <th>JIB / Grad</th>
                  <th>Administrator Tenanta</th>
                  <th>Poslovne godine u bazi</th>
                  <th>Objekata / Artikala</th>
                  <th>Akcija</th>
                </tr>
              </thead>
              <tbody>
                ${superAdminData.tenants.map(t => `
                  <tr>
                    <td class="mono" style="font-weight: 800; color: #3b82f6;">${t.code}</td>
                    <td style="font-weight: 700;">${t.name}</td>
                    <td class="mono">${t.tax_number} · ${t.city || ''}</td>
                    <td>
                      ${t.admins.map(a => `<div><strong>${a.full_name}</strong> (<span class="mono">${a.email}</span>)</div>`).join('')}
                    </td>
                    <td>
                      <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                        ${t.fiscalYears.map(fy => `
                          <span class="badge ${fy.is_closed ? 'badge-amber' : 'badge-emerald'}">${fy.year}</span>
                        `).join('')}
                      </div>
                    </td>
                    <td class="mono">${t.storesCount} obj. / ${t.itemsCount} art.</td>
                    <td>
                      <button onclick="openNewYearForTenant('${t.id}', '${t.name}')" class="btn btn-secondary" style="padding: 5px 10px; font-size: 11.5px;">
                        + Otvori 2027. godinu
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- OUTBOX POSLANIH ADMINISTRATORSKIH RAČUNA I RESET KODOVA -->
        <div class="card">
          <h3 style="font-size: 14.5px; font-weight: 800; margin-bottom: 10px;">Evidencija poslanih administratorskih računa i email obavještenja (Outbox)</h3>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Vrijeme</th>
                  <th>Tip poruke</th>
                  <th>Primalac (Tenant Admin)</th>
                  <th>Predmet</th>
                  <th>Pristupni podaci / Akcija</th>
                </tr>
              </thead>
              <tbody>
                ${superAdminData.sentEmails.map(e => `
                  <tr>
                    <td class="mono" style="font-size: 11.5px; color: var(--text-muted);">${e.created_at}</td>
                    <td><span class="badge ${e.email_type === 'TENANT_ADMIN_CREDENTIALS' ? 'badge-emerald' : 'badge-sky'}">${e.email_type}</span></td>
                    <td><strong>${e.recipient_name}</strong><br/><span class="mono" style="font-size: 11.5px; color: var(--text-muted);">${e.recipient_email}</span></td>
                    <td>${e.subject}</td>
                    <td>
                      ${e.metadata && e.metadata.tempPassword ? `
                        <button onclick="loginAsIssuedTenantAdmin('${e.recipient_email}', '${e.metadata.tempPassword}')" class="btn btn-primary" style="padding: 5px 10px; font-size: 11.5px;">
                          Prijavi se kao ${e.recipient_email} (${e.metadata.tempPassword}) ➔
                        </button>
                      ` : `<span class="mono">Kod: ${e.metadata.resetCode || '-'}</span>`}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
    return;
  }

  // --------------------------------------------------------------------------
  // B) GLAVNA FORMA TENANTA (MAIN FORM — POZIV REGISTARA I DOKUMENATA)
  // --------------------------------------------------------------------------
  if (activeTabId === 'main-launcher') {
    const st = getCurrentStoreObj();
    body.innerHTML = `
      <div style="max-width: 1220px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">

        <!-- Zaglavlje Glavne Forme -->
        <div class="card" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge badge-emerald">${tenantData.tenant ? tenantData.tenant.code : 'TENANT'}</span>
              <span class="badge badge-sky">POSLOVNA ${tenantData.fiscalYear}. GODINA</span>
              <span class="badge badge-amber">OBJEKAT: ${st.code}</span>
            </div>
            <h1 style="font-size: 19px; font-weight: 800; margin-top: 6px;">
              Glavna Forma — ${tenantData.tenant ? tenantData.tenant.name : ''} (${st.name})
            </h1>
            <p style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">
              Pozovite željeni <strong>Registar (Šifarnik)</strong> ili <strong>Robni dokument</strong> klikom na karticu ispod ili iz lijevog menija.
            </p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button onclick="openWorkspaceTab('pos', 'POS Kasa (Terminal)')" class="btn btn-emerald">
              Otvori POS Kasu (F1)
            </button>
            <button onclick="openWorkspaceTab('reg-items', 'Registar Artikala (F2)')" class="btn btn-primary">
              Otvori Registar Artikala (F2)
            </button>
          </div>
        </div>

        <!-- 1. SEKCIJA: POZIVANJE REGISTARA / ŠIFARNIKA -->
        <div>
          <h2 style="font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 10px;">
            1. Pozivanje Registara i Šifarnika (Matični podaci Tenanta)
          </h2>
          <div class="grid-3">
            <div onclick="openWorkspaceTab('reg-items', 'Registar Artikala (F2)')" class="registry-card">
              <div>
                <div style="display: flex; justify-content: space-between;">
                  <span class="badge badge-sky">REGISTAR · F2</span>
                  <span class="mono" style="font-weight: 700;">${tenantData.items.length} artikala</span>
                </div>
                <h3 style="font-size: 15px; font-weight: 800; margin-top: 8px;">Registar Artikala i Barkodova</h3>
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                  Centralni šifarnik artikala, EAN barkodova, transportnih pakovanja, normativa i podataka za deklaracije.
                </p>
              </div>
              <span style="color: #3b82f6; font-weight: 700; font-size: 12px;">Pozovi Registar artikala ➔</span>
            </div>

            <div onclick="openWorkspaceTab('reg-prices', 'Cjenovnici po objektima (F3)')" class="registry-card">
              <div>
                <div style="display: flex; justify-content: space-between;">
                  <span class="badge badge-amber">REGISTAR · F3</span>
                  <span class="mono" style="font-weight: 700;">${tenantData.stores.length} objekta</span>
                </div>
                <h3 style="font-size: 15px; font-weight: 800; margin-top: 8px;">Cjenovnici i Zalihe po Objektima</h3>
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                  Svaki prodajni objekat ima sopstvenu cijenu i stanje za odabranu poslovnu (${tenantData.fiscalYear}.) godinu.
                </p>
              </div>
              <span style="color: #3b82f6; font-weight: 700; font-size: 12px;">Pozovi Registar cjenovnika ➔</span>
            </div>

            <div onclick="openWorkspaceTab('reg-partners', 'Registar Partnera (F4)')" class="registry-card">
              <div>
                <div style="display: flex; justify-content: space-between;">
                  <span class="badge badge-emerald">REGISTAR · F4</span>
                  <span class="mono" style="font-weight: 700;">${tenantData.partners.length} partnera</span>
                </div>
                <h3 style="font-size: 15px; font-weight: 800; margin-top: 8px;">Registar Partnera (Dobavljači i Kupci)</h3>
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                  Šifarnik dobavljača i B2B kupaca sa JIB/PIB brojevima, PDV brojevima i valutama plaćanja.
                </p>
              </div>
              <span style="color: #3b82f6; font-weight: 700; font-size: 12px;">Pozovi Registar partnera ➔</span>
            </div>

            <div onclick="openWorkspaceTab('reg-stores', 'Registar Objekata i Kasa')" class="registry-card">
              <div>
                <span class="badge badge-sky">INFRASTRUKTURA</span>
                <h3 style="font-size: 15px; font-weight: 800; margin-top: 8px;">Registar Prodajnih Objekata i Kasa</h3>
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                  Pregled svih marketa, magacina i naplatnih kasa sa izolovanim sekvencama računa.
                </p>
              </div>
              <span style="color: #3b82f6; font-weight: 700; font-size: 12px;">Pozovi Registar objekata ➔</span>
            </div>

            <div onclick="openWorkspaceTab('reg-labels', 'Šabloni Deklaracija i Cijena')" class="registry-card">
              <div>
                <span class="badge badge-amber">ŠTAMPA ETIKETA</span>
                <h3 style="font-size: 15px; font-weight: 800; margin-top: 8px;">Šabloni Deklaracija i Cijena za Police</h3>
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                  Dizajner cijena za police (sa automatskim izračunom 1 kg / 1 l), akcijskih etiketa i uvoznih deklaracija.
                </p>
              </div>
              <span style="color: #3b82f6; font-weight: 700; font-size: 12px;">Otvori Šablone deklaracija ➔</span>
            </div>

            <div onclick="openWorkspaceTab('doc-calc', 'Ulazne Kalkulacije')" class="registry-card">
              <div>
                <span class="badge badge-emerald">ROBNI DOKUMENTI (${tenantData.fiscalYear}.)</span>
                <h3 style="font-size: 15px; font-weight: 800; margin-top: 8px;">Kalkulacije, Prelokacije i Nivelacije</h3>
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                  Unos novih ulaznih kalkulacija, međuskladišnih prelokacija između objekata i zapisnika o promjeni cijene.
                </p>
              </div>
              <span style="color: var(--emerald); font-weight: 700; font-size: 12px;">Otvori Robne dokumente ➔</span>
            </div>
          </div>
        </div>

      </div>
    `;
    return;
  }

  // --------------------------------------------------------------------------
  // C) REGISTAR ARTIKALA I BARKODOVA (F2) — SA UNOSOM U BAZU
  // --------------------------------------------------------------------------
  if (activeTabId === 'reg-items') {
    const st = getCurrentStoreObj();
    body.innerHTML = `
      <div style="max-width: 1220px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px;">
        <div class="card" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;">
          <div>
            <span class="badge badge-sky">REGISTAR ARTIKALA · POSLOVNA ${tenantData.fiscalYear}. GODINA</span>
            <h2 style="font-size: 16px; font-weight: 800; margin-top: 4px;">Registar Artikala, Barkodova i Cijena po Objektima</h2>
          </div>
        </div>

        <!-- Forma za brzi unos novog artikla u Registar u bazi -->
        <div class="card">
          <h3 style="font-size: 13.5px; font-weight: 800; margin-bottom: 10px;">+ Dodaj ili izmijeni artikal u Registru (upis direktno u SQLite bazu)</h3>
          <div class="grid-4">
            <div class="form-group">
              <label class="form-label">Šifra artikla (SKU) *</label>
              <input id="regItemSku" type="text" class="form-input mono" placeholder="npr. 10550" value="10550" />
            </div>
            <div class="form-group">
              <label class="form-label">EAN Barkod *</label>
              <input id="regItemBarcode" type="text" class="form-input mono" placeholder="npr. 3870009988771" value="3870009988771" />
            </div>
            <div class="form-group">
              <label class="form-label">Naziv artikla *</label>
              <input id="regItemName" type="text" class="form-input" placeholder="npr. Mlijeko Moja Kravica 1L" value="Mlijeko Moja Kravica 1L" />
            </div>
            <div class="form-group">
              <label class="form-label">Nabavna i MPC cijena (${st.code})</label>
              <div style="display: flex; gap: 6px;">
                <input id="regItemNc" type="number" step="0.10" class="form-input mono" placeholder="NC" value="1.65" />
                <input id="regItemMpc" type="number" step="0.10" class="form-input mono" placeholder="MPC" value="2.35" />
                <button onclick="saveNewRegistryItem()" class="btn btn-primary">Sačuvaj</button>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Šifra (SKU)</th>
                  <th>Barkod</th>
                  <th>Naziv artikla</th>
                  <th>Kategorija / Porijeklo</th>
                  <th>JM</th>
                  <th>Nabavna cij.</th>
                  ${tenantData.stores.map(s => `<th>MPC: ${s.code}</th>`).join('')}
                  <th>Zaliha (${st.code} · ${tenantData.fiscalYear}.)</th>
                </tr>
              </thead>
              <tbody>
                ${tenantData.items.map(it => `
                  <tr>
                    <td class="mono" style="font-weight: 800; color: #3b82f6;">${it.sku}</td>
                    <td class="mono">${it.barcode}</td>
                    <td style="font-weight: 700;">${it.name}</td>
                    <td>${it.category_name} · ${it.origin_country}</td>
                    <td>${it.uom}</td>
                    <td class="mono">${Number(it.purchasePrice || 0).toFixed(2)} KM</td>
                    ${tenantData.stores.map(s => `<td class="mono" style="font-weight: 700; color: var(--emerald);">${Number(it.storePrices[s.id] || 0).toFixed(2)} KM</td>`).join('')}
                    <td class="mono" style="font-weight: 800;">${Number(it.storeStocks[st.id] || 0)} ${it.uom}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // --------------------------------------------------------------------------
  // D) REGISTAR CJENOVNIKA PO OBJEKTIMA (F3)
  // --------------------------------------------------------------------------
  if (activeTabId === 'reg-prices') {
    body.innerHTML = `
      <div style="max-width: 1220px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px;">
        <div class="card">
          <span class="badge badge-amber">CJENOVNICI PO OBJEKTIMA · ${tenantData.fiscalYear}. GODINA</span>
          <h2 style="font-size: 16px; font-weight: 800; margin-top: 4px;">Uporedni Pregled Cijena i Zaliha po Prodajnim Objektima</h2>
          <p style="font-size: 12px; color: var(--text-muted);">Promijenite poslovnu godinu u lijevom panelu (2026 vs 2025) da vidite kako se iz iste baze učitavaju cjenovnici i zalihe za odabranu godinu.</p>
        </div>
        <div class="card">
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Šifra</th>
                  <th>Artikal</th>
                  ${tenantData.stores.map(s => `<th>${s.code} (${s.name}) — Cijena &amp; Zaliha</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${tenantData.items.map(it => `
                  <tr>
                    <td class="mono" style="font-weight: 700;">${it.sku}</td>
                    <td style="font-weight: 700;">${it.name}</td>
                    ${tenantData.stores.map(s => `
                      <td class="mono">
                        <strong style="color: var(--emerald);">${Number(it.storePrices[s.id] || 0).toFixed(2)} KM</strong>
                        <span style="color: var(--text-muted); margin-left: 8px;">(Stanje: ${Number(it.storeStocks[s.id] || 0)} ${it.uom})</span>
                      </td>
                    `).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // --------------------------------------------------------------------------
  // E) REGISTAR PARTNERA (DOBAVLJAČI I KUPCI - F4)
  // --------------------------------------------------------------------------
  if (activeTabId === 'reg-partners') {
    body.innerHTML = `
      <div style="max-width: 1220px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px;">
        <div class="card">
          <h3 style="font-size: 14px; font-weight: 800; margin-bottom: 10px;">+ Novi Partner u Registar (Dobavljač / Kupac)</h3>
          <div class="grid-4">
            <input id="partCode" type="text" class="form-input mono" placeholder="Šifra (npr. DOB-009)" value="DOB-009" />
            <input id="partName" type="text" class="form-input" placeholder="Naziv firme partnera" value="Violeta d.o.o. Grude" />
            <input id="partJib" type="text" class="form-input mono" placeholder="JIB / PIB" value="4272551190002" />
            <div style="display: flex; gap: 8px;">
              <input id="partCity" type="text" class="form-input" placeholder="Grad" value="Grude" />
              <button onclick="saveNewPartner()" class="btn btn-primary">Dodaj u Registar</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Šifra</th>
                  <th>Naziv partnera</th>
                  <th>Tip</th>
                  <th>JIB / PIB</th>
                  <th>PDV broj</th>
                  <th>Grad</th>
                  <th>Valuta plaćanja</th>
                </tr>
              </thead>
              <tbody>
                ${tenantData.partners.map(p => `
                  <tr>
                    <td class="mono" style="font-weight: 800; color: #3b82f6;">${p.code}</td>
                    <td style="font-weight: 700;">${p.name}</td>
                    <td><span class="badge badge-sky">${p.partner_type}</span></td>
                    <td class="mono">${p.tax_number}</td>
                    <td class="mono">${p.vat_number || '-'}</td>
                    <td>${p.city || '-'}</td>
                    <td class="mono">${p.payment_due_days} dana</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // --------------------------------------------------------------------------
  // F) ULAZNE KALKULACIJE (PRIJEM ROBE U BAZU)
  // --------------------------------------------------------------------------
  if (activeTabId === 'doc-calc') {
    const calcs = tenantData.documents.filter(d => d.doc_type === 'CALCULATION' || d.doc_type === 'PRICE_LEVELING');
    body.innerHTML = `
      <div style="max-width: 1220px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px;">
        <div class="card" style="border: 2px solid rgba(16, 185, 129, 0.45);">
          <span class="badge badge-emerald">NOVA ULAZNA KALKULACIJA · ${tenantData.fiscalYear}. GODINA</span>
          <h2 style="font-size: 15.5px; font-weight: 800; margin-top: 4px; margin-bottom: 12px;">Unos Nove Kalkulacije (automatski ažurira zalihu i kreira Nivelaciju pri promjeni MPC)</h2>
          <div class="grid-4">
            <div class="form-group">
              <label class="form-label">Prodajni objekat (Ulaz u):</label>
              <select id="calcStoreId" class="form-select">
                ${tenantData.stores.map(s => `<option value="${s.id}" ${s.id === currentSession.activeStoreId ? 'selected' : ''}>${s.code} · ${s.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Dobavljač &amp; Faktura:</label>
              <input id="calcSupplier" type="text" class="form-input" value="AS Holding / Vispak d.d." />
            </div>
            <div class="form-group">
              <label class="form-label">Artikal iz registra:</label>
              <select id="calcItemId" class="form-select">
                ${tenantData.items.map(i => `<option value="${i.id}">${i.sku} — ${i.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Kol. / Nabavna / Nova MPC:</label>
              <div style="display: flex; gap: 6px;">
                <input id="calcQty" type="number" class="form-input mono" value="50" title="Količina" />
                <input id="calcNc" type="number" step="0.10" class="form-input mono" value="7.10" title="Nabavna cijena" />
                <input id="calcMpc" type="number" step="0.10" class="form-input mono" value="10.40" title="Nova MPC sa PDV" />
              </div>
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end;">
            <button onclick="submitNewCalculation()" class="btn btn-emerald">✓ Proknjiži Kalkulaciju u Bazu</button>
          </div>
        </div>

        <div class="card">
          <h3 style="font-size: 14px; font-weight: 800; margin-bottom: 10px;">Proknjižene Kalkulacije i Nivelacije u Poslovnoj ${tenantData.fiscalYear}. godini</h3>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Broj dokumenta</th>
                  <th>Tip</th>
                  <th>Datum</th>
                  <th>Objekat</th>
                  <th>Partner / Opis</th>
                  <th>Nabavna / Stara vrij.</th>
                  <th>Prodajna / Nova vrij.</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${calcs.map(d => `
                  <tr>
                    <td class="mono" style="font-weight: 800; color: var(--emerald);">${d.doc_number}</td>
                    <td><span class="badge ${d.doc_type === 'CALCULATION' ? 'badge-emerald' : 'badge-amber'}">${d.doc_type}</span></td>
                    <td class="mono">${d.doc_date}</td>
                    <td style="font-weight: 700;">${d.store_name || ''}</td>
                    <td>${d.partner_name || d.notes || ''}</td>
                    <td class="mono">${Number(d.total_purchase_value || 0).toFixed(2)} KM</td>
                    <td class="mono" style="font-weight: 800;">${Number(d.total_retail_value || 0).toFixed(2)} KM</td>
                    <td><span class="badge badge-emerald">${d.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // --------------------------------------------------------------------------
  // G) PRELOKACIJE (MEĐUSKLADIŠNICE IZMEĐU OBJEKATA)
  // --------------------------------------------------------------------------
  if (activeTabId === 'doc-transfer') {
    const transfers = tenantData.documents.filter(d => d.doc_type === 'TRANSFER');
    body.innerHTML = `
      <div style="max-width: 1220px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px;">
        <div class="card" style="border: 2px solid rgba(14, 165, 233, 0.45);">
          <span class="badge badge-sky">NOVA PRELOKACIJA · ${tenantData.fiscalYear}. GODINA</span>
          <h2 style="font-size: 15.5px; font-weight: 800; margin-top: 4px; margin-bottom: 12px;">Unos Nove Prelokacije između Prodajnih Objekata</h2>
          <div class="grid-4">
            <div class="form-group">
              <label class="form-label">Iz objekta (Izlaz):</label>
              <select id="trFromStore" class="form-select">
                ${tenantData.stores.map((s, idx) => `<option value="${s.id}" ${idx === 0 ? 'selected' : ''}>${s.code} · ${s.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">U objekat (Ulaz):</label>
              <select id="trToStore" class="form-select">
                ${tenantData.stores.map((s, idx) => `<option value="${s.id}" ${idx === 1 ? 'selected' : ''}>${s.code} · ${s.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Artikal za prelokaciju:</label>
              <select id="trItemId" class="form-select">
                ${tenantData.items.map(i => `<option value="${i.id}">${i.sku} — ${i.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Količina za prenos:</label>
              <div style="display: flex; gap: 8px;">
                <input id="trQty" type="number" class="form-input mono" value="15" />
                <button onclick="submitNewTransfer()" class="btn btn-sky">⇄ Proknjiži Prelokaciju</button>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 style="font-size: 14px; font-weight: 800; margin-bottom: 10px;">Proknjižene Prelokacije u Poslovnoj ${tenantData.fiscalYear}. godini</h3>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Broj prelokacije</th>
                  <th>Datum</th>
                  <th>Iz objekta (Izlaz)</th>
                  <th>U objekat (Ulaz)</th>
                  <th>Razduženje izlaza</th>
                  <th>Zaduženje ulaza</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${transfers.map(t => `
                  <tr>
                    <td class="mono" style="font-weight: 800; color: var(--sky);">${t.doc_number}</td>
                    <td class="mono">${t.doc_date}</td>
                    <td style="font-weight: 700; color: var(--amber);">${t.store_name || ''}</td>
                    <td style="font-weight: 700; color: var(--emerald);">${t.target_store_name || ''}</td>
                    <td class="mono">${Number(t.total_purchase_value || 0).toFixed(2)} KM</td>
                    <td class="mono" style="font-weight: 800;">${Number(t.total_retail_value || 0).toFixed(2)} KM</td>
                    <td><span class="badge badge-sky">${t.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // --------------------------------------------------------------------------
  // H) POS KASA (TERMINAL PRODAJE - F1)
  // --------------------------------------------------------------------------
  if (activeTabId === 'pos') {
    const st = getCurrentStoreObj();
    let total = 0;
    const rowsHtml = posCart.map((line, idx) => {
      const it = tenantData.items.find(i => i.id === line.itemId);
      if (!it) return '';
      const price = Number(it.storePrices[st.id] || 0);
      const sub = price * line.qty;
      total += sub;
      return `
        <tr>
          <td style="font-weight: 700;">${it.name}</td>
          <td class="mono">${price.toFixed(2)} KM</td>
          <td class="mono" style="font-weight: 800;">${line.qty} ${it.uom}</td>
          <td class="mono" style="font-weight: 800; color: var(--emerald);">${sub.toFixed(2)} KM</td>
          <td><button onclick="posCart.splice(${idx},1); renderActiveWorkspace();" class="btn btn-secondary" style="padding: 3px 7px;">✕</button></td>
        </tr>
      `;
    }).join('');

    body.innerHTML = `
      <div style="max-width: 1220px; margin: 0 auto;" class="grid-2">
        <div class="card" style="display: flex; flex-direction: column; gap: 14px;">
          <div>
            <span class="badge badge-emerald">POS TERMINAL · ${st.code} · ${tenantData.fiscalYear}. GODINA</span>
            <h2 style="font-size: 16px; font-weight: 800; margin-top: 4px;">Katalog Artikala na Kasi (${st.name})</h2>
          </div>
          <div class="grid-3">
            ${tenantData.items.map(it => `
              <div onclick="addPosItem('${it.id}')" class="registry-card" style="padding: 12px;">
                <div style="font-weight: 700;">${it.name}</div>
                <div class="mono" style="font-size: 11.5px; color: var(--text-muted);">Barkod: ${it.barcode} · Zaliha: ${Number(it.storeStocks[st.id] || 0)}</div>
                <div class="mono" style="font-size: 15px; font-weight: 800; color: var(--emerald);">${Number(it.storePrices[st.id] || 0).toFixed(2)} KM</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; gap: 16px;">
          <div>
            <h3 style="font-size: 15px; font-weight: 800; margin-bottom: 10px;">Stavke aktivnog fiskalnog računa</h3>
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr><th>Artikal</th><th>Cijena</th><th>Kol.</th><th>Ukupno</th><th></th></tr>
                </thead>
                <tbody>
                  ${rowsHtml || '<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--text-muted);">Kliknite na artikal lijevo za dodavanje na račun</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>

          <div style="border-top: 1px solid var(--border-subtle); padding-top: 14px; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <span style="font-size: 14px; font-weight: 800;">ZA NAPLATU SA PDV (17%):</span>
              <span class="mono" style="font-size: 24px; font-weight: 900; color: var(--emerald);">${total.toFixed(2)} KM</span>
            </div>
            <button onclick="issueFiscalPosReceipt()" class="btn btn-emerald btn-block" style="font-size: 14px; padding: 13px;">
              ✓ FISKALIZUJ I ŠTAMPAJ RAČUN U BAZI (F5)
            </button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // --------------------------------------------------------------------------
  // I) REGISTAR OBJEKATA I KASA / ŠABLONI DEKLARACIJA
  // --------------------------------------------------------------------------
  body.innerHTML = `
    <div style="max-width: 1220px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px;">
      <div class="card">
        <span class="badge badge-sky">REGISTAR OBJEKATA, KASA I DEKLARACIJA</span>
        <h2 style="font-size: 16px; font-weight: 800; margin-top: 4px;">Prodajni Objekti i Kase Tenanta (${tenantData.tenant ? tenantData.tenant.name : ''})</h2>
      </div>
      <div class="grid-3">
        ${tenantData.stores.map(s => `
          <div class="card">
            <span class="badge badge-emerald">${s.code}</span>
            <h3 style="font-size: 15px; font-weight: 800; margin-top: 6px;">${s.name}</h3>
            <p style="font-size: 12px; color: var(--text-muted);">Tip: ${s.store_type} · Odgovorno lice: ${s.manager_name || '-'}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ============================================================================
// 5. AKCIJE SUPER-ADMINA I TENANTA PREMA BAZI PODATAKA
// ============================================================================
async function submitCreateTenantAndSendAccount() {
  try {
    const payload = {
      companyName: document.getElementById('saCompanyName').value,
      taxNumber: document.getElementById('saTaxNumber').value,
      vatNumber: document.getElementById('saVatNumber').value,
      city: document.getElementById('saCity').value,
      adminFullName: document.getElementById('saAdminName').value,
      adminEmail: document.getElementById('saAdminEmail').value,
      adminPassword: document.getElementById('saAdminPass').value,
      initialFiscalYear: Number(document.getElementById('saInitialYear').value || 2026)
    };

    const res = await apiCall('/api/super-admin/tenants', 'POST', payload);
    await loadSuperAdminData();
    renderActiveWorkspace();

    const creds = res.issuedCredentials;
    openGlobalModal(
      'Administratorski račun uspješno kreiran i poslan Tenantu!',
      `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="padding: 12px; border-radius: 10px; background: var(--emerald-bg); border: 1px solid var(--emerald); color: var(--emerald); font-weight: 700;">
            ✓ ${res.message}
          </div>
          <div style="padding: 14px; border-radius: 10px; background: var(--bg-input); border: 1px solid var(--border-subtle);" class="mono">
            <div><strong>Tenant oznaka:</strong> ${creds.tenantCode} (${creds.companyName})</div>
            <div><strong>Poslovna godina u bazi:</strong> ${creds.fiscalYear}</div>
            <div><strong>Email Administratora:</strong> ${creds.adminEmail}</div>
            <div><strong>Korisničko ime:</strong> ${creds.adminUsername}</div>
            <div><strong>Dodijeljena lozinka:</strong> ${creds.tempPassword}</div>
          </div>
          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 6px;">
            <button onclick="closeGlobalModal()" class="btn btn-secondary">Zatvori</button>
            <button onclick="closeGlobalModal(); loginAsIssuedTenantAdmin('${creds.adminEmail}', '${creds.tempPassword}');" class="btn btn-emerald">
              Prijavi se odmah kao ${creds.adminEmail} ➔
            </button>
          </div>
        </div>
      `
    );
  } catch (err) {
    showAppToast(err.message);
  }
}

async function loginAsIssuedTenantAdmin(email, password) {
  logoutUser();
  await quickLogin(email, password, 2026);
}

async function openNewYearForTenant(tenantId, tenantName) {
  try {
    const res = await apiCall(`/api/super-admin/tenants/${tenantId}/fiscal-years`, 'POST', { year: 2027 });
    await loadSuperAdminData();
    renderActiveWorkspace();
    showAppToast(res.message);
  } catch (err) {
    showAppToast(err.message);
  }
}

async function saveNewRegistryItem() {
  try {
    const st = getCurrentStoreObj();
    const storePrices = {};
    storePrices[st.id] = Number(document.getElementById('regItemMpc').value || 0);

    const res = await apiCall('/api/tenant/items', 'POST', {
      sku: document.getElementById('regItemSku').value,
      barcode: document.getElementById('regItemBarcode').value,
      name: document.getElementById('regItemName').value,
      purchasePrice: Number(document.getElementById('regItemNc').value || 0),
      storePrices,
      initialStock: 50
    });
    await loadTenantBootstrapData();
    renderActiveWorkspace();
    showAppToast(res.message);
  } catch (err) {
    showAppToast(err.message);
  }
}

async function saveNewPartner() {
  try {
    const res = await apiCall('/api/tenant/partners', 'POST', {
      code: document.getElementById('partCode').value,
      name: document.getElementById('partName').value,
      taxNumber: document.getElementById('partJib').value,
      city: document.getElementById('partCity').value
    });
    await loadTenantBootstrapData();
    renderActiveWorkspace();
    showAppToast(res.message);
  } catch (err) {
    showAppToast(err.message);
  }
}

async function submitNewCalculation() {
  try {
    const res = await apiCall('/api/tenant/documents/calculation', 'POST', {
      storeId: document.getElementById('calcStoreId').value,
      supplierName: document.getElementById('calcSupplier').value,
      itemId: document.getElementById('calcItemId').value,
      qty: Number(document.getElementById('calcQty').value),
      purchasePrice: Number(document.getElementById('calcNc').value),
      newRetailPrice: Number(document.getElementById('calcMpc').value)
    });
    await loadTenantBootstrapData();
    renderActiveWorkspace();
    showAppToast(res.message);
  } catch (err) {
    showAppToast(err.message);
  }
}

async function submitNewTransfer() {
  try {
    const res = await apiCall('/api/tenant/documents/transfer', 'POST', {
      fromStoreId: document.getElementById('trFromStore').value,
      toStoreId: document.getElementById('trToStore').value,
      itemId: document.getElementById('trItemId').value,
      qty: Number(document.getElementById('trQty').value)
    });
    await loadTenantBootstrapData();
    renderActiveWorkspace();
    showAppToast(res.message);
  } catch (err) {
    showAppToast(err.message);
  }
}

function addPosItem(itemId) {
  const existing = posCart.find(l => l.itemId === itemId);
  if (existing) existing.qty += 1;
  else posCart.push({ itemId, qty: 1 });
  renderActiveWorkspace();
}

async function issueFiscalPosReceipt() {
  try {
    const st = getCurrentStoreObj();
    const term = tenantData.terminals.find(t => t.store_id === st.id) || tenantData.terminals[0];
    if (!posCart.length) {
      showAppToast('Dodajte bar jedan artikal na račun!');
      return;
    }
    const itemsPayload = posCart.map(l => {
      const it = tenantData.items.find(i => i.id === l.itemId);
      return { itemId: l.itemId, qty: l.qty, unitPrice: Number(it.storePrices[st.id] || 0) };
    });

    const res = await apiCall('/api/tenant/pos/receipt', 'POST', {
      storeId: st.id,
      terminalId: term.id,
      items: itemsPayload,
      paymentMethod: 'CASH'
    });
    posCart = [];
    await loadTenantBootstrapData();
    renderActiveWorkspace();
    showAppToast(`${res.message} — Ukupno: ${res.totalAmount.toFixed(2)} KM`);
  } catch (err) {
    showAppToast(err.message);
  }
}

function openGlobalModal(title, htmlContent) {
  document.getElementById('globalModalTitle').textContent = title;
  document.getElementById('globalModalContent').innerHTML = htmlContent;
  document.getElementById('globalModal').classList.remove('hidden');
}

function closeGlobalModal() {
  document.getElementById('globalModal').classList.add('hidden');
}

// Inicijalna provjera sesije pri otvaranju stranice
(async function initApp() {
  if (authToken) {
    try {
      const me = await apiCall('/api/auth/me');
      currentSession = me;
      await enterApplicationShell();
    } catch {
      logoutUser();
    }
  }
})();
