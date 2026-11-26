// Gastos por categoria (Início e Cartões): gráfico + legenda clicável que abre os lançamentos da categoria.
import { donutChart } from '../charts.js';
import { icon } from '../icons.js';
import { abrirEdicao } from './lancamento-edicao.js';
import { catIcon, linhaLancamento, modal } from '../ui.js';
import { compact, esc, money, pct } from '../utils.js';

const SEM = 'sem';   // categoria vazia (inclui a diferença para o valor oficial da fatura)

/** HTML do quadro. `itens` = [{ categoria_id, total }], já em ordem do maior para o menor. */
export function quadroCategorias({ id, titulo = 'Gastos por categoria', itens, total, cat, dica }) {
  if (!itens.length) {
    return `<article class="card cat-gasto" id="${id}"><h2 class="card-title">${esc(titulo)}</h2><div class="empty">Nenhum gasto aqui.</div></article>`;
  }
  return `
    <article class="card cat-gasto" id="${id}">
      <h2 class="card-title">${esc(titulo)}</h2>
      <div class="donut-wrap" style="width:160px;height:160px">
        <canvas role="img" aria-label="${esc(titulo)}"></canvas>
        <div class="donut-center"><span class="muted small">Total</span><strong>${compact(total)}</strong></div>
      </div>
      <div class="legend">
        ${itens.map((c) => {
          const k = cat(c.categoria_id);
          return `<button type="button" class="legend-row legend-botao" data-cat="${c.categoria_id || SEM}" aria-label="Ver lançamentos de ${esc(k.nome)}">
            ${catIcon(k, 14)}<span class="name">${esc(k.nome)}</span>
            <span class="muted">${pct((c.total / (total || 1)) * 100, 0)}%</span><span class="val">${compact(c.total)}</span>
            ${icon('direita', 14, 2.2)}</button>`;
        }).join('')}
      </div>
      ${dica ? `<p class="muted small">${esc(dica)}</p>` : ''}
    </article>`;
}

/** Desenha o gráfico e liga o clique de cada categoria a `aoEscolher(categoria_id | null)`. */
export function ligarQuadro(raiz, { itens, cat, aoEscolher }) {
  const canvas = raiz?.querySelector('canvas');
  if (canvas) {
    donutChart(canvas, {
      labels: itens.map((c) => cat(c.categoria_id).nome),
      values: itens.map((c) => c.total),
      colors: itens.map((c) => cat(c.categoria_id).cor),
    });
  }
  raiz?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (b) aoEscolher(b.dataset.cat === SEM ? null : b.dataset.cat);
  });
}

/** Janela com os lançamentos da categoria; tocar num lançamento abre a edição. */
export function abrirCategoria({ categoria, periodo, total, lancamentos, ajuste, cat, cats, cartoes, depois, faturaMes }) {
  const mapaCartoes = cartoes ? new Map(cartoes.map((c) => [c.id, c])) : undefined;
  const { el, fechar } = modal(`${categoria.nome} · ${periodo}`, `
    <div class="form-col">
      <div class="cat-resumo">
        ${catIcon(categoria, 18)}
        <span class="muted small">${lancamentos.length} lançamento${lancamentos.length === 1 ? '' : 's'}</span>
        <strong class="cat-total">${money(total)}</strong>
      </div>
      ${ajuste ? `<div class="aviso">Inclui ${money(ajuste)} de diferença entre o valor oficial da fatura e o que foi lançado.</div>` : ''}
      <div class="lista-card cat-lista">
        ${lancamentos.length
          ? lancamentos.map((t) => linhaLancamento(t, cat(t.categoria_id), { cartoes: mapaCartoes })).join('')
          : '<div class="empty">Nenhum lançamento.</div>'}
      </div>
      <p class="muted small">Toque num lançamento para editar ou mudar a categoria.</p>
    </div>`);
  el.querySelector('.cat-lista').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tx]');
    const t = b && lancamentos.find((x) => x.id === b.dataset.tx);
    if (!t) return;
    fechar();
    abrirEdicao(t, cats, depois, { faturaMes });
  });
}
