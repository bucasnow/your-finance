import { api, sessao } from './api.js';
import { destroyCharts } from './charts.js';
import { icon } from './icons.js';
import { erroBox, skeleton, toast } from './ui.js';
import { esc, money } from './utils.js';

const TELAS_APP = {
  '#/inicio': () => import('./telas/inicio.js'),
  '#/lancamentos': () => import('./telas/lancamentos.js'),
  '#/novo': () => import('./telas/novo.js'),
  '#/importar': () => import('./telas/importar.js'),
  '#/cartoes': () => import('./telas/cartoes.js'),
  '#/investimentos': () => import('./telas/investimentos.js'),
  '#/conta': () => import('./telas/conta.js'),
};

const TELAS_ENTRADA = ['#/entrar', '#/cadastro', '#/esqueci', '#/redefinir', '#/2fa'];

const MENU = [
  { hash: '#/inicio', nome: 'Início', ic: 'inicio' },
  { hash: '#/lancamentos', nome: 'Lançamentos', ic: 'lista' },
  { hash: '#/cartoes', nome: 'Cartões', ic: 'cartao' },
  { hash: '#/investimentos', nome: 'Investimentos', ic: 'investimento' },
];

const TITULOS = {
  '#/inicio': 'Início', '#/lancamentos': 'Lançamentos', '#/novo': 'Novo lançamento', '#/importar': 'Importar fatura',
  '#/cartoes': 'Cartões', '#/investimentos': 'Investimentos', '#/conta': 'Minha conta',
};

const iniciais = (nome) => (nome || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

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
  const u = sessao.usuario || {};
  const nome = u.nome || 'Minha conta';
  app.innerHTML = `
    <div class="moldura">
      <aside class="sidebar">
        <a class="marca" href="#/inicio">
          <span class="marca-icone">${icon('logo', 22, 2.8)}</span>
          <span class="marca-texto"><strong>fin.app</strong><span class="muted small trunca">Finanças de ${esc(nome.split(' ')[0])}</span></span>
        </a>
        <nav class="sidebar-nav" aria-label="Menu principal">
          <span class="nav-indicador" aria-hidden="true"></span>
          ${MENU.map((n) => `<a href="${n.hash}" class="nav-item" data-hash="${n.hash}">${icon(n.ic, 20)}<span>${n.nome}</span></a>`).join('')}
          <div class="side-sep"></div>
          <a href="#/importar" class="nav-item" data-hash="#/importar">${icon('importar', 20)}<span>Importar fatura</span></a>
          <a href="#/conta" class="nav-item" data-hash="#/conta">${icon('usuario', 20)}<span>Minha conta</span></a>
        </nav>
        <div class="side-extra" id="side-extra"></div>
        <a href="#/conta" class="perfil-link">
          <span class="avatar-mini">${esc(iniciais(nome))}</span>
          <span><strong class="trunca">${esc(nome)}</strong><span class="muted small trunca">${esc(u.email || '')}</span></span>
        </a>
      </aside>

      <div class="area">
        <header class="topbar">
          <a class="topbar-marca" href="#/inicio">
            <span class="marca-icone">${icon('logo', 20, 2.8)}</span>
            <span class="topbar-titulo" id="topbar-titulo">Início</span>
          </a>
          <form class="busca-global" role="search" id="busca-global">
            ${icon('busca', 18)}
            <input type="search" name="q" placeholder="Buscar lançamentos" aria-label="Buscar lançamentos" autocomplete="off">
            <kbd>/</kbd>
          </form>
          <a href="#/lancamentos?busca=" class="btn-redondo busca-movel" aria-label="Buscar">${icon('busca', 20)}</a>
          <a href="#/novo" class="btn-redondo menta" aria-label="Novo lançamento" title="Novo lançamento">${icon('mais', 22, 2.4)}</a>
          <a href="#/importar" class="btn-redondo so-desktop" aria-label="Importar fatura" title="Importar fatura">${icon('importar', 19, 2.2)}</a>
          <span class="topbar-sep"></span>
          <a href="#/conta" class="avatar-topo" aria-label="Minha conta" title="${esc(nome)}">${esc(iniciais(nome))}</a>
        </header>
        <div class="main-wrap"><main id="view" class="view" role="main"></main></div>
      </div>
    </div>

    <nav class="bottom-nav" aria-label="Navegação">
      <span class="nav-indicador" aria-hidden="true"></span>
      ${[...MENU, { hash: '#/conta', nome: 'Conta', ic: 'usuario' }].map((n) => `
        <a href="${n.hash}" class="nav-btm" data-hash="${n.hash}">${icon(n.ic, 22)}<span>${n.nome}</span></a>`).join('')}
    </nav>`;

  const busca = app.querySelector('#busca-global');
  busca.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = busca.q.value.trim();
    ir(`#/lancamentos?busca=${encodeURIComponent(q)}`);
  });
  // "/" foca a busca, como em outros apps
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.target.closest('input, textarea, select') && document.getElementById('busca-global')) {
      e.preventDefault();
      document.querySelector('#busca-global input').focus();
    }
  });
}

/** Cartão do menu lateral: quanto ainda dá para gastar hoje na meta semanal. */
async function atualizarLateral() {
  const box = document.getElementById('side-extra');
  if (!box || !matchMedia('(min-width: 821px)').matches) return;
  try {
    const [meta] = await api.metas();
    if (!meta) { box.innerHTML = ''; return; }
    const hoje = Math.max(0, meta.restante) / (meta.dias_restantes + 1);
    box.innerHTML = `
      <a href="#/inicio" class="side-card">
        <span class="muted small">${esc(meta.nome)}: pode gastar hoje</span>
        <strong class="valor">${money(hoje)}</strong>
        <span class="muted small">${money(Math.max(0, meta.restante))} até domingo · ${meta.dias_restantes + 1} dia${meta.dias_restantes ? 's' : ''}</span>
      </a>`;
  } catch { box.innerHTML = ''; }
}

// ── Animações de troca de tela ───────────────────────────────────────────────
const reduzirMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const LINHAS = '.tx-row, .parc-linha, .rv-item, .legend-row, .faturas-mes-linha, .day-head';

/** A nova tela entra em cascata: cada bloco e as primeiras linhas das listas, um depois do outro. */
function animarEntrada(view, suave) {
  view.classList.remove('entrando', 'entrando-suave');
  if (reduzirMovimento()) return;
  [...view.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 8)));
  [...view.querySelectorAll(LINHAS)].forEach((l, j) => l.style.setProperty('--j', Math.min(j, 14)));
  void view.offsetWidth;   // reinicia a animação
  view.classList.add(suave ? 'entrando-suave' : 'entrando');
}

/** A faixa menta desliza até o item ativo, no menu lateral e na barra do celular. */
function moverIndicadores(caminho) {
  document.querySelectorAll('.sidebar-nav, .bottom-nav').forEach((nav) => {
    const ind = nav.querySelector('.nav-indicador');
    const ativo = nav.querySelector(`[data-hash="${caminho}"]`);
    if (!ind) return;
    if (!ativo || !ativo.offsetParent) { ind.style.opacity = '0'; return; }
    const primeira = !ind.dataset.pronto;
    if (primeira) ind.style.transition = 'none';
    ind.style.opacity = '1';
    ind.style.transform = `translate(${ativo.offsetLeft}px, ${ativo.offsetTop}px)`;
    ind.style.width = `${ativo.offsetWidth}px`;
    ind.style.height = `${ativo.offsetHeight}px`;
    if (primeira) { void ind.offsetWidth; ind.style.transition = ''; ind.dataset.pronto = '1'; }
  });
}
window.addEventListener('resize', () => moverIndicadores(rotaAtual().caminho));

async function mostrar(opcoes) {
  const suave = !!opcoes?.suave;   // recarregar depois de salvar: sem saída, só um esmaecer leve
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
  moverIndicadores(caminho);
  const titulo = document.getElementById('topbar-titulo');
  if (titulo) titulo.textContent = TITULOS[caminho] || 'fin.app';
  atualizarLateral();

  const view = document.getElementById('view');
  const ctx = { params, ir, atual: () => gen === geracao, recarregar: () => mostrar({ suave: true }) };
  const tela = TELAS_APP[caminho]();   // começa a baixar o código da tela enquanto a atual sai

  // Saída: a tela atual esmaece e desfoca rapidinho
  if (!suave && view.childElementCount && !reduzirMovimento()) {
    view.classList.remove('entrando', 'entrando-suave');
    view.classList.add('saindo');
    await esperar(150);
    if (gen !== geracao) return;
  }
  if (!suave) {
    window.scrollTo(0, 0);
    view.parentElement.scrollTo?.(0, 0);
  }
  // Se os dados demorarem, mostra o esqueleto; se vierem rápido, vai direto para a tela nova
  const esqueleto = setTimeout(() => {
    if (gen !== geracao || suave) return;
    view.innerHTML = skeleton(120) + skeleton(260);
    view.classList.remove('saindo');
  }, view.childElementCount ? 250 : 0);
  try {
    const modulo = await tela;
    if (gen !== geracao) return;
    await modulo.render(view, ctx);
    clearTimeout(esqueleto);
    if (gen !== geracao) return;
    view.classList.remove('saindo');
    animarEntrada(view, suave);
  } catch (e) {
    clearTimeout(esqueleto);
    view.classList.remove('saindo');
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

// Chegaram dados mais novos do que os mostrados: redesenha de leve, se a pessoa não estiver digitando
const TELAS_SO_LEITURA = ['#/inicio', '#/lancamentos', '#/cartoes', '#/investimentos', '#/conta'];
let redesenho = null;
document.addEventListener('fin:dados-novos', () => {
  clearTimeout(redesenho);
  redesenho = setTimeout(() => {
    const ativo = document.activeElement;
    const digitando = ativo && /^(INPUT|TEXTAREA|SELECT)$/.test(ativo.tagName);
    if (!TELAS_SO_LEITURA.includes(rotaAtual().caminho) || digitando || document.querySelector('.modal-fundo')) return;
    mostrar({ suave: true });
  }, 120);
});

// Baixa o código das outras telas enquanto o navegador está livre
(window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(() => {
  if (sessao.token) Object.values(TELAS_APP).forEach((carregar) => carregar().catch(() => {}));
});

document.addEventListener('fin:lento', (e) => {
  document.getElementById('banner').hidden = !e.detail;
});

window.addEventListener('hashchange', mostrar);
window.__finOk = true;
if (!location.hash) history.replaceState(null, '', '#/inicio');
mostrar();
