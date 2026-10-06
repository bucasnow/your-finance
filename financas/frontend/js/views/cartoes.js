import { api } from '../api.js';
import { money, pct, esc, ddmm, monthShort, animateBars, MESES } from '../utils.js';
import { lookups, plastic, skeleton, errorBox } from './shared.js';

let selecionado = null;

export async function render(el, ctx) {
  el.innerHTML = `<h1 class="page-title">Cartões</h1>${skeleton(60)}${skeleton(420)}`;
  let cartoes, L;
  try { [cartoes, L] = await Promise.all([api.cartoes(), lookups()]); } catch (e) { el.innerHTML = errorBox(e.message); return; }
  if (ctx.stale()) return;
  if (!cartoes.length) { el.innerHTML = '<h1 class="page-title">Cartões</h1><div class="card"><div class="empty">Nenhum cartão cadastrado.</div></div>'; return; }

  const qid = ctx.params.get('id');
  if (qid && cartoes.some((c) => c.id === qid)) selecionado = qid;
  if (!selecionado || !cartoes.some((c) => c.id === selecionado)) selecionado = cartoes[0].id;

  el.innerHTML = `
    <header class="page-head"><h1 class="page-title">Cartões</h1></header>
    <div class="seg" role="tablist" id="card-tabs">
      ${cartoes.map((c) => `<button type="button" role="tab" data-id="${c.id}" class="${c.id === selecionado ? 'on' : ''}" aria-selected="${c.id === selecionado}">${esc(c.nome)}</button>`).join('')}
    </div>
    <div id="card-detail"></div>`;

  const detail = el.querySelector('#card-detail');

  async function load() {
    detail.innerHTML = skeleton(480);
    let f;
    try { f = await api.fatura(selecionado); } catch (e) { detail.innerHTML = errorBox(e.message); return; }
    if (ctx.stale()) return;
    const c = f.cartao;
    const u = (c.limite_usado / c.limite) * 100;
    const mesNome = MESES[Number(f.mes.split('-')[1]) - 1].toLowerCase();
    const maxNext = Math.max(...f.proximas.map((p) => p.valor), 1);

    detail.innerHTML = `
      <div class="cards-layout view-enter">
        <div style="display:flex;flex-direction:column;gap:20px">
          ${plastic(c, { big: true })}
          <section class="card">
            <div class="card-head" style="align-items:center"><span class="muted small strong">Fatura de ${mesNome}</span><span class="badge pos">${f.status === 'aberta' ? 'Aberta' : 'Fechada'}</span></div>
            <div style="font-size:34px;font-weight:800;letter-spacing:-0.02em">${money(f.total)}</div>
            <div class="info-grid">
              <div class="info"><span class="muted small">Fechamento</span><strong>${ddmm(c.fechamento)}</strong></div>
              <div class="info"><span class="muted small">Vencimento</span><strong>${ddmm(c.vencimento)}</strong></div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px">
              <div class="bar thick"><span data-w="${u}"></span></div>
              <div class="small" style="display:flex;justify-content:space-between;gap:8px"><span class="muted">Usado ${money(c.limite_usado)} (${pct(u)}%)</span><span class="strong">Disponível ${money(c.limite - c.limite_usado)}</span></div>
            </div>
          </section>
          <section class="card">
            <h2 class="card-title" style="font-size:16px">Próximas faturas</h2>
            ${f.proximas.map((p) => `
              <div style="display:flex;align-items:center;gap:12px;font-size:14px">
                <span class="muted strong" style="width:36px">${monthShort(p.mes)}</span>
                <div class="bar" style="flex:1"><span data-w="${(p.valor / maxNext) * 100}" style="background:var(--info)"></span></div>
                <span class="strong" style="min-width:96px;text-align:right">${money(p.valor)}</span>
              </div>`).join('')}
          </section>
        </div>
        <section class="card" style="gap:0;padding-bottom:8px">
          <div class="card-head" style="padding-bottom:10px"><h2 class="card-title" style="font-size:16px">Lançamentos da fatura</h2></div>
          ${f.itens.map((t) => {
            const cat = L.cat(t.categoria_id);
            return `
            <div style="display:flex;align-items:center;gap:12px;min-height:58px;border-bottom:1px solid var(--line)">
              <span class="dot round" style="width:8px;height:8px;background:${cat.cor}"></span>
              <div class="tx-main"><span class="tx-desc">${esc(t.descricao)}</span><span class="tx-meta">${esc(t.detalhe)} · ${esc(cat.nome)}</span></div>
              <span class="tx-val">${money(t.valor)}</span>
            </div>`;
          }).join('')}
        </section>
      </div>`;
    animateBars(detail);
  }

  el.querySelector('#card-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]'); if (!b || b.dataset.id === selecionado) return;
    selecionado = b.dataset.id;
    el.querySelectorAll('#card-tabs button').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
    load();
  });

  load();
}
