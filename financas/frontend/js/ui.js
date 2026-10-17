import { icon } from './icons.js';
import { alpha, brl, esc, rotuloDia } from './utils.js';

export const FORMAS = {
  pix: 'Pix', debito: 'Débito', credito: 'Crédito', dinheiro: 'Dinheiro', boleto: 'Boleto', transferencia: 'Transferência',
};

let timerToast;
export function toast(msg, tipo = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${tipo}`;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => { el.className = 'toast'; }, 2800);
}

export const skeleton = (h = 160) => `<div class="skeleton" style="height:${h}px"></div>`;

export function erroBox(el, mensagem, tentarDeNovo) {
  el.innerHTML = `
    <div class="card erro-box">
      <div class="empty">
        <strong>Não foi possível carregar.</strong><br><span class="small">${esc(mensagem)}</span>
      </div>
      ${tentarDeNovo ? '<button class="btn btn-ghost" type="button" data-retry>Tentar de novo</button>' : ''}
    </div>`;
  el.querySelector('[data-retry]')?.addEventListener('click', tentarDeNovo);
}

/** Desabilita o botão e troca o texto enquanto a ação roda. */
export function ocupado(btn, sim, texto = 'Aguarde…') {
  if (!btn) return;
  if (sim) { btn.dataset.texto = btn.innerHTML; btn.disabled = true; btn.innerHTML = texto; }
  else { btn.disabled = false; if (btn.dataset.texto) btn.innerHTML = btn.dataset.texto; }
}

export function catIcon(cat, size = 19) {
  return `<span class="cat-icon" style="background:${alpha(cat.cor, 0.16)};color:${cat.cor}">${icon(cat.icone, size)}</span>`;
}

export const SEM_CATEGORIA = { id: null, nome: 'Sem categoria', cor: '#94A3B8', icone: 'outros', tipo: 'despesa' };
export function categoriaPorId(cats) {
  const mapa = new Map(cats.map((c) => [c.id, c]));
  return (id) => mapa.get(id) || SEM_CATEGORIA;
}

export function linhaLancamento(t, cat, { cartoes } = {}) {
  const receita = t.tipo === 'receita';
  const parcela = t.total_parcelas > 1 ? ` · ${t.parcela_atual}/${t.total_parcelas}` : '';
  const cartao = t.cartao_id && cartoes ? cartoes.get(t.cartao_id) : null;
  const forma = cartao ? esc(cartao.nome) : FORMAS[t.forma_pagamento] || '';
  return `
    <button type="button" class="tx-row" data-tx="${t.id}">
      ${catIcon(cat)}
      <span class="tx-main">
        <span class="tx-desc">${esc(t.descricao)}</span>
        <span class="tx-meta">${rotuloDia(t.data)} · ${esc(cat.nome)} · ${forma}${parcela}</span>
      </span>
      <span class="tx-val ${receita ? 'pos' : ''}">${receita ? '+' : '−'} R$ ${brl(t.valor)}</span>
    </button>`;
}

/** Abre uma janela sobre a tela. Devolve { el, fechar }. */
export function modal(titulo, conteudo) {
  const fundo = document.createElement('div');
  fundo.className = 'modal-fundo';
  fundo.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
      <header class="modal-head">
        <h2>${esc(titulo)}</h2>
        <button class="icon-btn" type="button" data-fechar aria-label="Fechar">${icon('fechar', 20, 2.2)}</button>
      </header>
      <div class="modal-corpo">${conteudo}</div>
    </div>`;
  document.body.appendChild(fundo);
  document.body.classList.add('com-modal');

  const aoTeclar = (e) => { if (e.key === 'Escape') fechar(); };
  function fechar() {
    document.removeEventListener('keydown', aoTeclar);
    window.removeEventListener('hashchange', fechar);
    fundo.remove();
    if (!document.querySelector('.modal-fundo')) document.body.classList.remove('com-modal');
  }
  fundo.addEventListener('mousedown', (e) => { if (e.target === fundo) fechar(); });
  fundo.querySelector('[data-fechar]').addEventListener('click', fechar);
  document.addEventListener('keydown', aoTeclar);
  window.addEventListener('hashchange', fechar);
  requestAnimationFrame(() => fundo.querySelector('input:not([type=hidden]), select, textarea')?.focus());
  return { el: fundo.querySelector('.modal-corpo'), fechar };
}

/** Pergunta de confirmação. Resolve com o valor do botão escolhido, ou null se fechar. */
export function confirmar(titulo, texto, botoes = [{ valor: true, rotulo: 'Confirmar', perigo: true }]) {
  return new Promise((resolve) => {
    const { el, fechar } = modal(titulo, `
      <p class="muted">${esc(texto)}</p>
      <div class="acoes-col">
        ${botoes.map((b, i) => `<button type="button" class="btn btn-block ${b.perigo ? 'btn-perigo' : i === 0 ? 'btn-primary' : 'btn-ghost'}" data-i="${i}">${esc(b.rotulo)}</button>`).join('')}
        <button type="button" class="btn btn-block btn-ghost" data-i="-1">Cancelar</button>
      </div>`);
    let escolhido = null;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const i = Number(b.dataset.i);
      escolhido = i >= 0 ? botoes[i].valor : null;
      fechar();
    });
    const observador = new MutationObserver(() => {
      if (!el.isConnected) { observador.disconnect(); resolve(escolhido); }
    });
    observador.observe(document.body, { childList: true });
  });
}
