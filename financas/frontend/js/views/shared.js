import { icon } from '../icons.js';
import { brl, esc, dayLabel, alpha, ddmm } from '../utils.js';
import { getCategorias, getFormas } from '../api.js';

export async function lookups() {
  const [cats, formas] = await Promise.all([getCategorias(), getFormas()]);
  return {
    cats,
    formas,
    cat: (id) => cats.find((c) => c.id === id) || { nome: 'Outros', cor: '#94A3B8', icone: 'outros' },
    forma: (id) => formas.find((f) => f.id === id) || { nome: id || '—' }
  };
}

export function catIcon(cat, size = 19) {
  return `<span class="cat-icon" style="background:${alpha(cat.cor, 0.14)};color:${cat.cor}">${icon(cat.icone, size)}</span>`;
}

export function txRow(t, L, { showCat = false, longDate = false } = {}) {
  const cat = L.cat(t.categoria_id);
  const income = t.tipo === 'receita';
  const parc = t.total_parcelas > 1 ? ` · ${t.parcela_atual || 1}/${t.total_parcelas}` : '';
  const meta = showCat ? `${esc(cat.nome)} · ${esc(L.forma(t.forma_pagamento_id).nome)}${parc}` : `${dayLabel(t.data, longDate)} · ${esc(L.forma(t.forma_pagamento_id).nome)}${parc}`;
  return `
    <div class="tx-row">
      ${catIcon(cat)}
      <div class="tx-main"><span class="tx-desc">${esc(t.descricao)}</span><span class="tx-meta">${meta}</span></div>
      <span class="tx-val ${income ? 'pos' : ''}">${income ? '+' : '−'} R$ ${brl(t.valor)}</span>
    </div>`;
}

export function plastic(c, { big = false, showBill = true } = {}) {
  if (big) {
    return `
      <div class="plastic big ${c.estilo}">
        <div class="p-top"><span style="font-size:15px;font-weight:800;letter-spacing:.02em">${esc(c.nome)}</span><span style="opacity:.7">${icon('contactless', 26)}</span></div>
        <div class="chipset" style="width:44px;height:34px;border-radius:8px"></div>
        <div class="p-foot"><span class="p-num">•••• •••• •••• ${esc(c.final)}</span><span style="opacity:.8">${esc(c.validade || '')}</span></div>
      </div>`;
  }
  return `
    <div class="plastic ${c.estilo}">
      <div class="p-top">
        <div style="display:flex;flex-direction:column;gap:2px">
          <span class="p-name">${esc(c.nome)}</span>
          ${showBill ? `<span class="p-value">R$ ${brl(c.fatura_atual)}</span><span style="font-size:11px;opacity:.75">fatura atual</span>` : ''}
        </div>
        <div class="chipset"></div>
      </div>
      <div class="p-foot"><span class="p-num">•••• ${esc(c.final)}</span><span style="opacity:.8">Fecha ${ddmm(c.fechamento)} · Vence ${ddmm(c.vencimento)}</span></div>
    </div>`;
}

export const skeleton = (h = 160) => `<div class="skeleton" style="height:${h}px"></div>`;
export const errorBox = (msg) => `<div class="card"><div class="empty">Não foi possível carregar os dados.<br><span class="small">${esc(msg)}</span></div></div>`;
