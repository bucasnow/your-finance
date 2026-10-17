import { api, sessao } from './api.js';
import { destroyCharts } from './charts.js';
import { icon } from './icons.js';
import { erroBox, skeleton, toast } from './ui.js';
import { esc } from './utils.js';

const TELAS_APP = {
  '#/inicio': () => import('./telas/inicio.js'),
  '#/lancamentos': () => import('./telas/lancamentos.js'),
  '#/novo': () => import('./telas/novo.js'),
  '#/cartoes': () => import('./telas/cartoes.js'),
  '#/investimentos': () => import('./telas/investimentos.js'),
  '#/conta': () => import('./telas/conta.js'),
};

const TELAS_ENTRADA = ['#/entrar', '#/cadastro', '#/esqueci', '#/redefinir', '#/2fa'];

const MENU = [
  { hash: '#/inicio', nome: 'Início', ic: 'inicio' },
  { hash: '#/lancamentos', nome: 'Lançamentos', ic: 'lista' },
  { hash: '#/novo', nome: 'Novo', ic: 'mais', fab: true },
  { hash: '#/cartoes', nome: 'Cartões', ic: 'cartao' },
  { hash: '#/investimentos', nome: 'Investimentos', ic: 'investimento' },
];

let geracao = 0;

function rotaAtual() {
  let [caminho, consulta = ''] = (location.hash || '').split('?');
  if (caminho === '#/reset') caminho = '#/redefinir';
  return { caminho, params: new URLSearchParams(consulta) };
}

export function ir(hash) {
  if (location.hash === hash) mostrar();
  else location.hash = hash;
}

function exibir(qual) {
  document.getElementById('boot')?.remove();
  document.getElementById('auth').hidden = qual !== 'auth';
  document.getElementById('app').hidden = qual !== 'app';
}

function montarShell() {
  const app = document.getElementById('app');
  if (app.dataset.montado === sessao.token) return;
  app.dataset.montado = sessao.token;
  const nome = sessao.usuario?.nome || 'Minha conta';
  app.innerHTML = `
    <aside class="sidebar">
      <a class="sidebar-logo" href="#/inicio">${icon('logo', 24, 2.6)}<span>fin.app</span></a>
      <a class="btn btn-primary btn-block" href="#/novo">${icon('mais', 18, 2.6)}Novo lançamento</a>
      <nav class="sidebar-nav" aria-label="Menu principal">
        ${MENU.filter((n) => !n.fab).map((n) => `<a href="${n.hash}" class="nav-item" data-hash="${n.hash}">${icon(n.ic, 20)}<span>${n.nome}</span></a>`).join('')}
      </nav>
      <a href="#/conta" class="nav-item conta-link" data-hash="#/conta">${icon('usuario', 20)}<span class="trunca">${esc(nome)}</span></a>
    </aside>

    <header class="topbar">
      <a class="sidebar-logo" href="#/inicio">${icon('logo', 22, 2.6)}<span>fin.app</span></a>
      <a href="#/conta" class="icon-btn" aria-label="Minha conta" data-hash="#/conta">${icon('usuario', 22)}</a>
    </header>

    <div class="main-wrap"><main id="view" class="view" role="main"></main></div>

    <nav class="bottom-nav" aria-label="Navegação">
      ${MENU.map((n) => n.fab
        ? `<a href="${n.hash}" class="nav-fab" data-hash="${n.hash}" aria-label="Novo lançamento">${icon(n.ic, 26, 2.4)}</a>`
        : `<a href="${n.hash}" class="nav-btm" data-hash="${n.hash}">${icon(n.ic, 22)}<span>${n.nome}</span></a>`).join('')}
    </nav>`;
}

async function mostrar() {
  const { caminho, params } = rotaAtual();
  const gen = ++geracao;
  destroyCharts();
  const logado = !!sessao.token;

  if (TELAS_ENTRADA.includes(caminho)) {
    if (logado && caminho !== '#/redefinir') return ir('#/inicio');
    exibir('auth');
    const telas = await import('./telas/entrada.js');
    if (gen === geracao) telas.render(caminho, document.getElementById('auth-box'), { params, ir });
    return;
  }

  if (!logado) return ir('#/entrar');
  if (!TELAS_APP[caminho]) return ir('#/inicio');

  montarShell();
  exibir('app');
  document.querySelectorAll('#app [data-hash]').forEach((a) => a.classList.toggle('active', a.dataset.hash === caminho));

  const view = document.getElementById('view');
  view.innerHTML = skeleton(120) + skeleton(260);
  window.scrollTo(0, 0);
  const ctx = { params, ir, atual: () => gen === geracao, recarregar: mostrar };
  try {
    const tela = await TELAS_APP[caminho]();
    if (gen !== geracao) return;
    await tela.render(view, ctx);
  } catch (e) {
    if (gen !== geracao || e.status === 401) return;
    console.error(e);
    erroBox(view, e.message || String(e), mostrar);
  }
}

document.addEventListener('fin:sair', (e) => {
  api.limparCache();
  document.getElementById('app').dataset.montado = '';
  document.querySelectorAll('.modal-fundo').forEach((m) => m.remove());
  if (e.detail) toast(e.detail);
  ir('#/entrar');
});

document.addEventListener('fin:entrou', () => {
  api.limparCache();
  ir('#/inicio');
});

document.addEventListener('fin:lento', (e) => {
  document.getElementById('banner').hidden = !e.detail;
});

window.addEventListener('hashchange', mostrar);
window.__finOk = true;
if (!location.hash) history.replaceState(null, '', '#/inicio');
mostrar();
