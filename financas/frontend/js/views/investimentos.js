import { api } from '../api.js';
import { icon } from '../icons.js';
import { money, pct, esc, ddmm, monthShort, alpha, toast } from '../utils.js';
import { areaChart, donutChart } from '../charts.js';
import { skeleton, errorBox } from './shared.js';

let filtroTipo = '';

export async function render(el, ctx) {
  el.innerHTML = `<h1 class="page-title">Investimentos</h1>${skeleton(300)}${skeleton(300)}`;
  let d;
  try { d = await api.investimentos(); } catch (e) { el.innerHTML = errorBox(e.message); return; }
  if (ctx.stale()) return;

  const tipo = (id) => d.tipos.find((t) => t.id === id) || { nome: id, cor: '#94A3B8' };
  const porTipo = d.tipos.map((t) => ({ ...t, valor: d.ativos.filter((a) => a.tipo_id === t.id).reduce((s, a) => s + a.valor, 0) }));
  const aportes30 = d.aportes.reduce((s, a) => s + a.valor, 0);

  el.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">Investimentos</h1>
    </header>

    <section class="grid-3">
      <article class="card span-2">
        <span class="muted small strong">Patrimônio investido</span>
        <div style="font-size:36px;font-weight:800;letter-spacing:-0.02em;margin-top:-8px">${money(d.total)}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:-6px">
          <span class="badge ${d.variacao_mes >= 0 ? 'pos' : 'neg'}">${d.variacao_mes >= 0 ? '+' : '−'} ${money(Math.abs(d.variacao_mes))} no mês</span>
          <span class="badge ${d.variacao_pct_6m >= 0 ? 'pos' : 'neg'}">${d.variacao_pct_6m >= 0 ? '+' : ''}${pct(d.variacao_pct_6m)}% em 6 meses</span>
        </div>
        <div class="chart-box" style="height:240px"><canvas id="ch-pat2" role="img" aria-label="Evolução do patrimônio"></canvas></div>
      </article>

      <article class="card">
        <h2 class="card-title">Distribuição</h2>
        <div class="donut-wrap" style="width:180px;height:180px">
          <canvas id="ch-dist" role="img" aria-label="Distribuição por tipo"></canvas>
          <div class="donut-center"><span class="muted small">${d.ativos.length} ativos</span><strong style="font-size:15px">${porTipo.length} classes</strong></div>
        </div>
        <div class="legend">
          ${porTipo.map((t) => `<div class="legend-row"><span class="dot round" style="background:${t.cor}"></span><span class="name">${esc(t.nome)}</span><span class="muted">${pct((t.valor / d.total) * 100)}%</span><span class="val">${money(t.valor)}</span></div>`).join('')}
        </div>
      </article>
    </section>

    <section class="grid-3">
      <article class="card span-2" style="gap:12px">
        <div class="card-head"><h2 class="card-title">Ativos</h2></div>
        <div class="filters" id="f-tipo">
          <button type="button" class="chip ${!filtroTipo ? 'on' : ''}" data-t="">Todos</button>
          ${d.tipos.map((t) => `<button type="button" class="chip ${filtroTipo === t.id ? 'on' : ''}" data-t="${t.id}"><span class="dot round" style="background:${t.cor}"></span>${esc(t.nome)}</button>`).join('')}
        </div>
        <div id="assets"></div>
      </article>

      <article class="card" style="gap:4px">
        <div class="card-head" style="padding-bottom:8px"><h2 class="card-title">Últimos aportes</h2><span class="muted small">${money(aportes30)}</span></div>
        ${d.aportes.map((a) => `
          <div style="display:flex;align-items:center;gap:12px;min-height:52px;font-size:14px">
            <span class="muted small strong" style="width:44px">${ddmm(a.data)}</span>
            <span class="strong" style="flex:1">${esc(a.ativo)}</span>
            <span class="pos strong">+ ${money(a.valor)}</span>
          </div>`).join('')}
      </article>
    </section>`;

  const assetsEl = el.querySelector('#assets');
  function renderAssets() {
    const list = d.ativos.filter((a) => !filtroTipo || a.tipo_id === filtroTipo).sort((a, b) => b.valor - a.valor);
    assetsEl.innerHTML = list.map((a, i) => {
      const t = tipo(a.tipo_id);
      return `
      <div style="display:flex;align-items:center;gap:12px;min-height:66px;${i < list.length - 1 ? 'border-bottom:1px solid var(--line)' : ''}">
        <span class="asset-badge" style="background:${alpha(t.cor, 0.14)};color:${t.cor}">${esc(a.sigla)}</span>
        <div class="tx-main"><span class="tx-desc">${esc(a.nome)}</span><span class="tx-meta">${esc(t.nome)} · ${pct((a.valor / d.total) * 100)}% da carteira</span></div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
          <span class="tx-val">${money(a.valor)}</span>
          <span class="small strong ${a.rent_mes >= 0 ? 'pos' : 'neg'}">${a.rent_mes >= 0 ? '+' : '−'}${pct(Math.abs(a.rent_mes), 2)}% no mês</span>
        </div>
      </div>`;
    }).join('') || '<div class="empty">Nenhum ativo nesta classe.</div>';
  }

  el.querySelector('#f-tipo').addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    filtroTipo = b.dataset.t;
    el.querySelectorAll('#f-tipo .chip').forEach((x) => x.classList.toggle('on', x === b));
    renderAssets();
  });

  renderAssets();
  areaChart(el.querySelector('#ch-pat2'), { labels: d.evolucao.map((e) => monthShort(e.mes)), values: d.evolucao.map((e) => e.valor) });
  donutChart(el.querySelector('#ch-dist'), { labels: porTipo.map((t) => t.nome), values: porTipo.map((t) => t.valor), colors: porTipo.map((t) => t.cor), cutout: '72%' });
}
