import { api } from '../api.js';
import { icon } from '../icons.js';
import { money, brl, pct, compact, esc, monthShortYear, today, isoDate, animateBars } from '../utils.js';
import { barChart, donutChart, sparkBars } from '../charts.js';
import { lookups, txRow, catIcon, skeleton, errorBox } from './shared.js';

export async function render(el, ctx) {
  el.innerHTML = `<h1 class="page-title">Início</h1>${skeleton(120)}${skeleton(300)}${skeleton(200)}`;

  let d, L;
  try { [d, L] = await Promise.all([api.dashboard(), lookups()]); } catch (e) { el.innerHTML = errorBox(e.message); return; }
  if (ctx.stale()) return;

  const saldo = d.receitas - d.despesas;
  const maxCat = Math.max(...(d.por_categoria || []).map((c) => c.valor), 1);

  el.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">Início</h1>
      <button class="icon-btn" id="db-add" aria-label="Novo lançamento">${icon('plus', 22, 2.2)}</button>
    </header>

    <section class="grid-3">
      <article class="card hero span-2">
        <span class="muted small strong">Saldo do mês</span>
        <div class="hero-val ${saldo < 0 ? 'neg' : ''}">${saldo < 0 ? '−' : ''} R$ ${brl(Math.abs(saldo))}</div>
        <div class="hero-pills">
          <span class="pill pos">${icon('arrow-up', 14)} R$ ${brl(d.receitas)}</span>
          <span class="pill neg">${icon('arrow-down', 14)} R$ ${brl(d.despesas)}</span>
        </div>
        <div class="progress-wrap">
          <div class="bar thick"><span data-w="${Math.min((d.despesas / (d.orcamento || 1)) * 100, 100)}" style="background:${d.despesas > d.orcamento ? 'var(--neg)' : 'var(--accent)'}"></span></div>
          <div class="small" style="display:flex;justify-content:space-between"><span class="muted">Gasto ${pct((d.despesas / (d.orcamento || 1)) * 100)}% do orçamento</span><span class="strong">${money(d.orcamento)}</span></div>
        </div>
      </article>

      <article class="card">
        <h2 class="card-title">Evolução</h2>
        <div class="chart-box" style="height:120px"><canvas id="ch-spark" role="img" aria-label="Evolução de gastos"></canvas></div>
        <div class="small muted" style="text-align:center">${monthShortYear(d.evolucao?.at(-1)?.mes || isoDate(today()))}</div>
      </article>
    </section>

    <section class="grid-3">
      <article class="card">
        <h2 class="card-title">Por categoria</h2>
        <div class="donut-wrap" style="width:160px;height:160px">
          <canvas id="ch-cat" role="img" aria-label="Gastos por categoria"></canvas>
          <div class="donut-center"><span class="muted small">Total</span><strong>${compact(d.despesas)}</strong></div>
        </div>
        <div class="legend">
          ${(d.por_categoria || []).slice(0, 5).map((c) => {
            const cat = L.cat(c.categoria_id);
            return `<div class="legend-row">${catIcon(cat, 14)}<span class="name">${esc(cat.nome)}</span><span class="muted">${pct((c.valor / (d.despesas || 1)) * 100)}%</span><span class="val">${compact(c.valor)}</span></div>`;
          }).join('')}
        </div>
      </article>

      <article class="card span-2">
        <h2 class="card-title">Gastos por mês</h2>
        <div class="chart-box" style="height:220px">
          <canvas id="ch-bar" role="img" aria-label="Gastos mensais"></canvas>
        </div>
      </article>
    </section>

    <section class="card" style="gap:0">
      <div class="card-head" style="padding-bottom:12px">
        <h2 class="card-title">Últimos lançamentos</h2>
        <a href="#/lancamentos" class="small muted strong" style="text-decoration:none">Ver todos</a>
      </div>
      ${(d.recentes || []).map((t) => txRow(t, L)).join('')}
      ${!(d.recentes?.length) ? '<div class="empty">Nenhum lançamento ainda.</div>' : ''}
    </section>`;

  animateBars(el);

  const cats = (d.por_categoria || []).slice(0, 5);
  if (cats.length) {
    donutChart(el.querySelector('#ch-cat'), {
      labels: cats.map((c) => L.cat(c.categoria_id).nome),
      values: cats.map((c) => c.valor),
      colors: cats.map((c) => L.cat(c.categoria_id).cor)
    });
  }

  if (d.evolucao?.length) {
    sparkBars(el.querySelector('#ch-spark'), d.evolucao.map((e) => e.valor));
    barChart(el.querySelector('#ch-bar'), {
      labels: d.evolucao.map((e) => monthShortYear(e.mes)),
      values: d.evolucao.map((e) => e.valor),
      highlight: d.evolucao.length - 1,
      budget: d.orcamento,
      showValues: true
    });
  }

  el.querySelector('#db-add')?.addEventListener('click', () => ctx.go('#/novo'));
}
