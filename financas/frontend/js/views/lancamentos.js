import { api } from '../api.js';
import { icon } from '../icons.js';
import { money, brl, esc, isoDate, today, monthKey, addMonths, groupBy, monthShortYear } from '../utils.js';
import { lookups, txRow, skeleton, errorBox } from './shared.js';

let mes = monthKey(today());
let catFiltro = '';
let tipoFiltro = '';

export async function render(el, ctx) {
  const qmes = ctx.params.get('mes');
  if (qmes) mes = qmes;

  el.innerHTML = `<h1 class="page-title">Lançamentos</h1>${skeleton(60)}${skeleton(400)}`;

  let txs, L;
  try { [txs, L] = await Promise.all([api.lancamentos(mes), lookups()]); } catch (e) { el.innerHTML = errorBox(e.message); return; }
  if (ctx.stale()) return;

  const mesDate = new Date(mes + '-01');
  const prevMes = monthKey(addMonths(mesDate, -1));
  const nextMes = monthKey(addMonths(mesDate, 1));
  const isCurrentMonth = mes === monthKey(today());

  function filtrados() {
    return txs.filter((t) => {
      if (catFiltro && t.categoria_id !== catFiltro) return false;
      if (tipoFiltro && t.tipo !== tipoFiltro) return false;
      return true;
    });
  }

  const allCats = [...new Set(txs.map((t) => t.categoria_id))].map((id) => L.cat(id));
  const totalDespesas = txs.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0);
  const totalReceitas = txs.filter((t) => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0);

  el.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">Lançamentos</h1>
      <button class="icon-btn" id="lc-add" aria-label="Novo lançamento">${icon('plus', 22, 2.2)}</button>
    </header>

    <div class="month-nav">
      <a href="#/lancamentos?mes=${prevMes}" class="icon-btn" aria-label="Mês anterior">${icon('chevron-left', 20, 2.2)}</a>
      <span class="strong" style="font-size:16px">${monthShortYear(mes + '-01')}</span>
      ${isCurrentMonth ? '<span style="width:44px"></span>' : `<a href="#/lancamentos?mes=${nextMes}" class="icon-btn" aria-label="Próximo mês">${icon('chevron-right', 20, 2.2)}</a>`}
    </div>

    <section class="card summary-row">
      <div class="info"><span class="muted small">Receitas</span><strong class="pos">${money(totalReceitas)}</strong></div>
      <div class="info"><span class="muted small">Despesas</span><strong class="neg">${money(totalDespesas)}</strong></div>
      <div class="info"><span class="muted small">Saldo</span><strong class="${totalReceitas - totalDespesas < 0 ? 'neg' : ''}">${money(totalReceitas - totalDespesas)}</strong></div>
    </section>

    <div class="filters" id="lc-tipos">
      <button type="button" class="chip ${!tipoFiltro ? 'on' : ''}" data-t="">Todos</button>
      <button type="button" class="chip ${tipoFiltro === 'despesa' ? 'on' : ''}" data-t="despesa">Despesas</button>
      <button type="button" class="chip ${tipoFiltro === 'receita' ? 'on' : ''}" data-t="receita">Receitas</button>
    </div>

    ${allCats.length > 1 ? `<div class="filters" id="lc-cats">
      <button type="button" class="chip ${!catFiltro ? 'on' : ''}" data-c="">Todas</button>
      ${allCats.map((c) => `<button type="button" class="chip ${catFiltro === c.id ? 'on' : ''}" data-c="${c.id}"><span class="dot round" style="background:${c.cor}"></span>${esc(c.nome)}</button>`).join('')}
    </div>` : ''}

    <section class="card" style="gap:0" id="lc-list">
      ${renderList(filtrados(), L)}
    </section>`;

  el.querySelector('#lc-add')?.addEventListener('click', () => ctx.go('#/novo'));

  el.querySelector('#lc-tipos')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    tipoFiltro = b.dataset.t;
    el.querySelectorAll('#lc-tipos .chip').forEach((x) => x.classList.toggle('on', x === b));
    el.querySelector('#lc-list').innerHTML = renderList(filtrados(), L);
  });

  el.querySelector('#lc-cats')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]'); if (b === null) return;
    catFiltro = b.dataset.c;
    el.querySelectorAll('#lc-cats .chip').forEach((x) => x.classList.toggle('on', x === b));
    el.querySelector('#lc-list').innerHTML = renderList(filtrados(), L);
  });
}

function renderList(txs, L) {
  if (!txs.length) return '<div class="empty">Nenhum lançamento encontrado.</div>';
  const grupos = groupBy(txs, (t) => t.data.slice(0, 10));
  const dias = Object.keys(grupos).sort((a, b) => b.localeCompare(a));
  return dias.map((dia) => {
    const lista = grupos[dia];
    const total = lista.reduce((s, t) => s + (t.tipo === 'despesa' ? -t.valor : t.valor), 0);
    return `
      <div class="day-group">
        <div class="day-head"><span class="strong small">${fmtDia(dia)}</span><span class="small muted">${total < 0 ? '−' : '+'} R$ ${brl(Math.abs(total))}</span></div>
        ${lista.map((t) => txRow(t, L)).join('')}
      </div>`;
  }).join('');
}

function fmtDia(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const t = today();
  if (dt.toDateString() === t.toDateString()) return 'Hoje';
  const ontem = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
  if (dt.toDateString() === ontem.toDateString()) return 'Ontem';
  return dt.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
}
