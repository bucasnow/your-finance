import { api } from '../api.js';
import { icon } from '../icons.js';
import { abrirEdicao } from './lancamento-edicao.js';
import { categoriaPorId, linhaLancamento } from '../ui.js';
import { brl, groupBy, mesAtual, mesValido, money, nomeMes, rotuloDia, somarMeses } from '../utils.js';

const filtro = { tipo: '', busca: '' };

export async function render(el, ctx) {
  const mes = mesValido(ctx.params.get('mes')) ? ctx.params.get('mes') : mesAtual();
  const [txs, cats, cartoes, recs] = await Promise.all([
    api.lancamentos(mes), api.categorias(), api.cartoes().catch(() => []), api.recorrencias().catch(() => []),
  ]);
  if (!ctx.atual()) return;

  const cat = categoriaPorId(cats);
  const mapaCartoes = new Map(cartoes.map((c) => [c.id, c]));
  const recorrencias = new Map(recs.map((r) => [r.id, r]));
  const receitas = txs.filter((t) => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0);
  const despesas = txs.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0);

  el.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">Lançamentos</h1>
      <div class="acoes-linha">
        <a href="#/importar" class="btn btn-ghost btn-compacto">${icon('importar', 18, 2.2)}Importar fatura</a>
        <a href="#/novo" class="icon-btn destaque" aria-label="Novo lançamento">${icon('mais', 22, 2.4)}</a>
      </div>
    </header>

    <div class="month-nav">
      <a href="#/lancamentos?mes=${somarMeses(mes, -1)}" class="icon-btn" aria-label="Mês anterior">${icon('esquerda', 20, 2.2)}</a>
      <span class="strong">${nomeMes(mes)}</span>
      <a href="#/lancamentos?mes=${somarMeses(mes, 1)}" class="icon-btn" aria-label="Próximo mês">${icon('direita', 20, 2.2)}</a>
    </div>

    <section class="card summary-row">
      <div class="info"><span class="muted small">Receitas</span><strong class="pos">${money(receitas)}</strong></div>
      <div class="info"><span class="muted small">Despesas</span><strong class="neg">${money(despesas)}</strong></div>
      <div class="info"><span class="muted small">Saldo</span><strong class="${receitas - despesas < 0 ? 'neg' : ''}">${money(receitas - despesas)}</strong></div>
    </section>

    <div class="filtros-linha">
      <div class="seg" id="lc-tipo">
        <button type="button" data-v="">Todos</button>
        <button type="button" data-v="despesa">Despesas</button>
        <button type="button" data-v="receita">Receitas</button>
      </div>
      <label class="busca">${icon('busca', 16)}<input type="search" id="lc-busca" placeholder="Buscar" value="${filtro.busca.replace(/"/g, '&quot;')}" aria-label="Buscar lançamento"></label>
    </div>

    <section class="card lista-card" id="lc-lista"></section>`;

  const lista = el.querySelector('#lc-lista');

  function desenhar() {
    el.querySelectorAll('#lc-tipo button').forEach((b) => b.classList.toggle('on', b.dataset.v === filtro.tipo));
    const termo = filtro.busca.trim().toLowerCase();
    const visiveis = txs.filter((t) => (!filtro.tipo || t.tipo === filtro.tipo)
      && (!termo || t.descricao.toLowerCase().includes(termo) || cat(t.categoria_id).nome.toLowerCase().includes(termo)));
    if (!visiveis.length) {
      lista.innerHTML = `<div class="empty">${txs.length ? 'Nenhum lançamento com esse filtro.' : 'Nenhum lançamento neste mês.'}</div>`;
      return;
    }
    const dias = groupBy(visiveis, (t) => t.data);
    lista.innerHTML = Object.keys(dias).sort((a, b) => b.localeCompare(a)).map((dia) => {
      const total = dias[dia].reduce((s, t) => s + (t.tipo === 'despesa' ? -t.valor : t.valor), 0);
      return `
        <div class="day-group">
          <div class="day-head"><span class="strong small">${rotuloDia(dia)}</span><span class="small muted">${total < 0 ? '−' : '+'} R$ ${brl(Math.abs(total))}</span></div>
          ${dias[dia].map((t) => linhaLancamento(t, cat(t.categoria_id), { cartoes: mapaCartoes, recorrencias })).join('')}
        </div>`;
    }).join('');
  }

  el.querySelector('#lc-tipo').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (b) { filtro.tipo = b.dataset.v; desenhar(); }
  });
  el.querySelector('#lc-busca').addEventListener('input', (e) => { filtro.busca = e.target.value; desenhar(); });
  lista.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tx]');
    const t = b && txs.find((x) => x.id === b.dataset.tx);
    if (t) abrirEdicao(t, cats, ctx.recarregar, { recorrencias });
  });

  desenhar();
}
