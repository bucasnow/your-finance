import { icon } from './icons.js';
import { destroyCharts } from './charts.js';
import { esc } from './utils.js';

const ROUTES = {
  '#/inicio': () => import('./views/dashboard.js'),
  '#/lancamentos': () => import('./views/lancamentos.js'),
  '#/novo': () => import('./views/novo.js'),
  '#/cartoes': () => import('./views/cartoes.js'),
  '#/investimentos': () => import('./views/investimentos.js'),
};

const NAV = [
  { hash: '#/inicio', label: 'Início', ic: 'home' },
  { hash: '#/lancamentos', label: 'Lançamentos', ic: 'list' },
  { hash: '#/novo', label: 'Novo', ic: 'plus', fab: true },
  { hash: '#/cartoes', label: 'Cartões', ic: 'card' },
  { hash: '#/investimentos', label: 'Investimentos', ic: 'chart' },
];

const API_BASE = () => window.FIN_CONFIG.apiBase;

// ─── Auth ────────────────────────────────────────────────────────────────────

function getToken() { return localStorage.getItem('finapp_token'); }
function saveToken(t) { localStorage.setItem('finapp_token', t); }
function clearToken() { localStorage.removeItem('finapp_token'); localStorage.removeItem('fin.username'); }

async function authPost(path, body, asForm = false) {
  const headers = {};
  let bodyData;
  if (asForm) {
    const fd = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) fd.append(k, v);
    bodyData = fd;
  } else {
    headers['Content-Type'] = 'application/json';
    bodyData = JSON.stringify(body);
  }
  const res = await fetch(API_BASE() + path, { method: 'POST', headers, body: bodyData });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || json.message || res.statusText);
  return json;
}

function showAuth() {
  document.getElementById('auth-overlay').hidden = false;
  document.getElementById('app-shell').hidden = true;
  renderLogin();
}

function hideAuth() {
  document.getElementById('auth-overlay').hidden = true;
  document.getElementById('app-shell').hidden = false;
}

function renderLogin() {
  const el = document.getElementById('auth-box');
  el.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">${icon('chart', 32)}<span>fin.app</span></div>
      <h1 class="auth-title">Entrar</h1>
      <form id="login-form" novalidate style="display:flex;flex-direction:column;gap:16px">
        <label class="field"><span class="field-label">Email</span>
          <input class="input" id="auth-email" type="email" placeholder="seu@email.com" autocomplete="email" required></label>
        <label class="field"><span class="field-label">Senha</span>
          <input class="input" id="auth-senha" type="password" placeholder="••••••••" autocomplete="current-password" required></label>
        <div class="form-error" id="auth-err" role="alert"></div>
        <button class="btn btn-primary btn-block" type="submit">Entrar</button>
        <button class="btn btn-ghost btn-block" type="button" id="go-register">Criar conta</button>
        <button class="btn btn-ghost btn-block" type="button" id="go-reset" style="font-size:13px;opacity:0.7">Esqueci minha senha</button>
      </form>
    </div>`;
  el.querySelector('#login-form').addEventListener('submit', handleLogin);
  el.querySelector('#go-register').addEventListener('click', renderRegister);
  el.querySelector('#go-reset').addEventListener('click', renderReset);
}

async function handleLogin(e) {
  e.preventDefault();
  const err = document.getElementById('auth-err');
  const email = document.getElementById('auth-email').value.trim();
  const senha = document.getElementById('auth-senha').value;
  if (!email || !senha) { err.textContent = 'Preencha email e senha.'; return; }
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true; err.textContent = '';
  try {
    const data = await authPost('/auth/login', { username: email, password: senha }, true);
    if (data.requires_2fa) {
      renderOtp(email, senha);
    } else {
      saveToken(data.access_token);
      localStorage.setItem('fin.username', data.nome || email.split('@')[0]);
      hideAuth();
      init();
    }
  } catch (ex) {
    err.textContent = ex.message || 'Erro ao entrar.';
    btn.disabled = false;
  }
}

function renderOtp(email, senha) {
  const el = document.getElementById('auth-box');
  el.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">${icon('chart', 32)}<span>fin.app</span></div>
      <h1 class="auth-title">Verificação</h1>
      <p class="muted small" style="text-align:center">Digite o código do Google Authenticator</p>
      <form id="otp-form" novalidate style="display:flex;flex-direction:column;gap:16px">
        <label class="field" style="align-items:center">
          <span class="field-label">Código</span>
          <input class="input" id="auth-otp" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="000000" autocomplete="one-time-code" required style="letter-spacing:0.3em;font-size:22px;text-align:center">
        </label>
        <div class="form-error" id="auth-err" role="alert"></div>
        <button class="btn btn-primary btn-block" type="submit">Verificar</button>
        <button class="btn btn-ghost btn-block" type="button" id="back-login">Voltar</button>
      </form>
    </div>`;
  el.querySelector('#otp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('auth-err');
    const otp = document.getElementById('auth-otp').value.trim();
    if (otp.length !== 6) { err.textContent = 'Código deve ter 6 dígitos.'; return; }
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; err.textContent = '';
    try {
      const data = await authPost('/auth/login', { username: email, password: senha }, true);
      // Se ainda requer 2FA, verificar com o código
      if (data.requires_2fa) {
        const data2 = await authPost('/auth/verificar-2fa', { codigo: otp, temp_token: data.temp_token });
        saveToken(data2.access_token);
        localStorage.setItem('fin.username', email.split('@')[0]);
        hideAuth(); init(); return;
      }
      saveToken(data.access_token);
      localStorage.setItem('fin.username', data.nome || email.split('@')[0]);
      hideAuth();
      init();
    } catch (ex) {
      err.textContent = ex.message || 'Código inválido.';
      btn.disabled = false;
    }
  });
  el.querySelector('#back-login').addEventListener('click', renderLogin);
}

function renderReset() {
  const el = document.getElementById('auth-box');
  el.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">${icon('chart', 32)}<span>fin.app</span></div>
      <h1 class="auth-title">Esqueci minha senha</h1>
      <p class="muted small" style="text-align:center">Digite seu e-mail e enviaremos um link para criar uma nova senha.</p>
      <form id="reset-form" novalidate style="display:flex;flex-direction:column;gap:16px">
        <label class="field"><span class="field-label">Email</span>
          <input class="input" id="rst-email" type="email" placeholder="seu@email.com" autocomplete="email" required></label>
        <div class="form-error" id="auth-err" role="alert"></div>
        <button class="btn btn-primary btn-block" type="submit">Enviar link</button>
        <button class="btn btn-ghost btn-block" type="button" id="back-login3">Voltar para o login</button>
      </form>
    </div>`;
  el.querySelector('#reset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('auth-err');
    const email = document.getElementById('rst-email').value.trim();
    if (!email) { err.textContent = 'Informe o e-mail.'; return; }
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; err.textContent = '';
    try {
      await authPost('/auth/solicitar-reset', { email });
      err.style.color = 'var(--pos)';
      err.textContent = 'Se o e-mail estiver cadastrado, você receberá um link em breve.';
    } catch (ex) {
      err.textContent = ex.message || 'Erro ao enviar.';
      btn.disabled = false;
    }
  });
  el.querySelector('#back-login3').addEventListener('click', renderLogin);
}

function renderNovasenha(token) {
  const el = document.getElementById('auth-box');
  el.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">${icon('chart', 32)}<span>fin.app</span></div>
      <h1 class="auth-title">Nova senha</h1>
      <form id="novasenha-form" novalidate style="display:flex;flex-direction:column;gap:16px">
        <label class="field"><span class="field-label">Nova senha</span>
          <input class="input" id="ns-senha" type="password" placeholder="Mínimo 8 caracteres" autocomplete="new-password" required minlength="8"></label>
        <label class="field"><span class="field-label">Confirmar senha</span>
          <input class="input" id="ns-confirm" type="password" placeholder="Repita a senha" autocomplete="new-password" required></label>
        <div class="form-error" id="auth-err" role="alert"></div>
        <button class="btn btn-primary btn-block" type="submit">Salvar nova senha</button>
      </form>
    </div>`;
  el.querySelector('#novasenha-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('auth-err');
    const nova_senha = document.getElementById('ns-senha').value;
    const confirm = document.getElementById('ns-confirm').value;
    if (nova_senha.length < 8) { err.textContent = 'Senha deve ter pelo menos 8 caracteres.'; return; }
    if (nova_senha !== confirm) { err.textContent = 'As senhas não coincidem.'; return; }
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; err.textContent = '';
    try {
      await authPost('/auth/confirmar-reset', { token, nova_senha });
      err.style.color = 'var(--pos)';
      err.textContent = 'Senha alterada! Redirecionando...';
      setTimeout(() => { location.hash = ''; renderLogin(); }, 1500);
    } catch (ex) {
      err.textContent = ex.message || 'Erro ao salvar.';
      btn.disabled = false;
    }
  });
}

function renderRegister() {
  const el = document.getElementById('auth-box');
  el.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">${icon('chart', 32)}<span>fin.app</span></div>
      <h1 class="auth-title">Criar conta</h1>
      <form id="reg-form" novalidate style="display:flex;flex-direction:column;gap:16px">
        <label class="field"><span class="field-label">Nome</span>
          <input class="input" id="reg-nome" type="text" placeholder="Seu nome" autocomplete="name" required></label>
        <label class="field"><span class="field-label">Email</span>
          <input class="input" id="reg-email" type="email" placeholder="seu@email.com" autocomplete="email" required></label>
        <label class="field"><span class="field-label">Senha</span>
          <input class="input" id="reg-senha" type="password" placeholder="Mínimo 8 caracteres" autocomplete="new-password" required minlength="8"></label>
        <div class="form-error" id="auth-err" role="alert"></div>
        <button class="btn btn-primary btn-block" type="submit">Criar conta</button>
        <button class="btn btn-ghost btn-block" type="button" id="back-login2">Já tenho conta</button>
      </form>
    </div>`;
  el.querySelector('#reg-form').addEventListener('submit', handleRegister);
  el.querySelector('#back-login2').addEventListener('click', renderLogin);
}

async function handleRegister(e) {
  e.preventDefault();
  const err = document.getElementById('auth-err');
  const nome = document.getElementById('reg-nome').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const senha = document.getElementById('reg-senha').value;
  if (!nome || !email || senha.length < 8) { err.textContent = 'Preencha todos os campos (senha mínimo 8 caracteres).'; return; }
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true; err.textContent = '';
  try {
    await authPost('/auth/registro', { nome, email, senha });
    const data = await authPost('/auth/login', { username: email, password: senha }, true);
    saveToken(data.access_token);
    localStorage.setItem('fin.username', nome);
    hideAuth();
    init();
  } catch (ex) {
    err.textContent = ex.message || 'Erro ao criar conta.';
    btn.disabled = false;
  }
}

// ─── Router / Shell ──────────────────────────────────────────────────────────

let currentHash = '';
let viewGeneration = 0;

function activeHash() {
  const h = location.hash || '#/inicio';
  return h.split('?')[0];
}

function go(hash) {
  location.hash = hash;
}

function buildShell() {
  const nome = localStorage.getItem('fin.username') || 'Usuário';
  document.getElementById('app-shell').innerHTML = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">${icon('chart', 24)}<span class="sidebar-brand">fin.app</span></div>
      <nav class="sidebar-nav" aria-label="Menu principal">
        ${NAV.filter((n) => !n.fab).map((n) => `
          <a href="${n.hash}" class="nav-item" data-hash="${n.hash}">
            ${icon(n.ic, 20)}<span>${n.label}</span>
          </a>`).join('')}
      </nav>
      <div class="sidebar-footer">
        <span class="muted small">${esc(nome)}</span>
        <button class="icon-btn" id="btn-logout" title="Sair" aria-label="Sair">${icon('logout', 18, 2)}</button>
      </div>
    </aside>

    <div class="main-wrap">
      <main id="view" class="view" role="main"></main>
    </div>

    <nav class="bottom-nav" aria-label="Navegação">
      ${NAV.map((n) => n.fab
        ? `<a href="${n.hash}" class="nav-fab" data-hash="${n.hash}" aria-label="${n.label}">${icon(n.ic, 26, 2.2)}</a>`
        : `<a href="${n.hash}" class="nav-btm" data-hash="${n.hash}">${icon(n.ic, 22)}<span>${n.label}</span></a>`
      ).join('')}
    </nav>`;

  document.getElementById('btn-logout').addEventListener('click', () => {
    clearToken();
    showAuth();
  });
}

function syncNav(hash) {
  document.querySelectorAll('[data-hash]').forEach((el) => {
    el.classList.toggle('active', el.dataset.hash === hash);
  });
}

async function navigate() {
  if (!getToken() && !window.FIN_CONFIG.useMock) { showAuth(); return; }

  const fullHash = location.hash || '#/inicio';
  const hash = fullHash.split('?')[0];
  const params = new URLSearchParams(fullHash.includes('?') ? fullHash.split('?')[1] : '');

  if (hash === currentHash && hash !== '#/novo') return;
  currentHash = hash;

  const gen = ++viewGeneration;
  const loader = ROUTES[hash] || ROUTES['#/inicio'];

  syncNav(hash);
  destroyCharts();

  const viewEl = document.getElementById('view');
  viewEl.innerHTML = '';

  const mod = await loader();
  if (gen !== viewGeneration) return;

  const ctx = {
    params,
    go,
    stale: () => gen !== viewGeneration,
  };

  await mod.render(viewEl, ctx);
}

function init() {
  buildShell();
  navigate();
  window.addEventListener('hashchange', navigate);
}

// ─── Boot ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Detecta link de reset de senha (?token=xxx ou #/reset?token=xxx)
  const urlParams = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(location.hash.includes('?') ? location.hash.split('?')[1] : '');
  const resetToken = urlParams.get('token') || hashParams.get('token');

  if (resetToken) {
    document.getElementById('auth-overlay').hidden = false;
    document.getElementById('app-shell').hidden = true;
    renderNovasenha(resetToken);
    return;
  }

  if (window.FIN_CONFIG.useMock || getToken()) {
    hideAuth();
    init();
  } else {
    showAuth();
  }
});
