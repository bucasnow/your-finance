import { api } from '../api.js';
import { icon } from '../icons.js';
import { brl, esc, isoDate, today, parseBRL, addMonths, monthKey, monthShortYear, toast } from '../utils.js';
import { lookups, catIcon, errorBox } from './shared.js';

export async function mountForm(el, { onDone, onCancel, asModal = false }) {
  let L;
  try { L = await lookups(); } catch (e) { el.innerHTML = errorBox(e.message); return; }

  const cats = L.cats.filter((c) => c.id !== 'receita');
  const formas = L.formas.filter((f) => f.id !== 'transferencia');
  const s = { categoria_id: cats[0]?.id || '', data: 'hoje', dataOutra: isoDate(today()), forma: formas[0]?.id || 'pix', parcelas: 1 };

  el.innerHTML = `
    <form class="${asModal ? 'card modal' : ''}" novalidate style="display:flex;flex-direction:column;gap:22px">
      <header style="display:flex;align-items:center;justify-content:space-between">
        <button class="icon-btn" type="button" data-act="cancel" aria-label="Fechar">${icon('close', 20, 2.2)}</button>
        <h1 style="font-size:17px;font-weight:700">Novo gasto</h1>
        <span style="width:44px"></span>
      </header>

      <label class="field" style="align-items:center">
        <span class="field-label">Valor</span>
        <div class="amount"><span>R$</span><input id="nv-valor" type="text" inputmode="decimal" placeholder="0,00" autocomplete="off" required></div>
      </label>

      <label class="field"><span class="field-label">Descrição</span>
        <input class="input" id="nv-desc" type="text" placeholder="Ex.: Mercado da semana" maxlength="80" required></label>

      <div class="field"><span class="field-label">Categoria</span>
        <div class="cat-grid" id="nv-cat" role="radiogroup" aria-label="Categoria">
          ${cats.map((c) => `<button type="button" class="tile" role="radio" data-id="${c.id}">${catIcon(c, 17)}${esc(c.nome)}</button>`).join('')}
        </div>
      </div>

      <div class="field"><span class="field-label">Data</span>
        <div class="opt-row" id="nv-data">
          <button type="button" class="chip" data-v="hoje">Hoje</button>
          <button type="button" class="chip" data-v="ontem">Ontem</button>
          <button type="button" class="chip" data-v="outra">Outra data</button>
        </div>
        <input class="input" id="nv-data-outra" type="date" value="${s.dataOutra}" hidden>
      </div>

      <div class="form-error" id="nv-err" role="alert"></div>
      <button class="btn btn-primary btn-block" type="submit">${icon('check', 20, 2.6)}Salvar gasto</button>
    </form>`;

  const $ = (sel) => el.querySelector(sel);
  const valorInput = $('#nv-valor');

  valorInput.addEventListener('input', () => {
    const digits = valorInput.value.replace(/\D/g, '').slice(0, 11);
    valorInput.value = digits ? brl(Number(digits) / 100) : '';
  });

  function syncSelections() {
    el.querySelectorAll('#nv-cat .tile').forEach((b) => { const on = b.dataset.id === s.categoria_id; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    el.querySelectorAll('#nv-data .chip').forEach((b) => b.classList.toggle('on', b.dataset.v === s.data));
    $('#nv-data-outra').hidden = s.data !== 'outra';
  }

  $('#nv-cat').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) { s.categoria_id = b.dataset.id; syncSelections(); } });
  $('#nv-data').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { s.data = b.dataset.v; syncSelections(); } });
  $('[data-act="cancel"]').onclick = onCancel;

  $('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#nv-err');
    const valor = parseBRL(valorInput.value);
    const descricao = $('#nv-desc').value.trim();
    if (valor <= 0) { err.textContent = 'Informe um valor maior que zero.'; valorInput.focus(); return; }
    if (!descricao) { err.textContent = 'Informe uma descrição.'; $('#nv-desc').focus(); return; }
    err.textContent = '';

    const t = today();
    const data = s.data === 'hoje' ? isoDate(t) : s.data === 'ontem' ? isoDate(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1)) : $('#nv-data-outra').value;

    const payload = {
      descricao,
      valor,
      data,
      categoria_id: s.categoria_id || null,
      forma_pagamento_id: s.forma,
      tipo: 'despesa'
    };

    const btn = $('button[type="submit"]');
    btn.disabled = true;
    try {
      await api.criarLancamento(payload);
      toast('Gasto salvo');
      onDone();
    } catch (ex) {
      err.textContent = ex.message || 'Erro ao salvar.';
      btn.disabled = false;
    }
  });

  syncSelections();
  if (!('ontouchstart' in window)) valorInput.focus();
}

export async function render(el, ctx) {
  el.innerHTML = '<div id="nv-host" style="max-width:520px;width:100%;margin:0 auto"></div>';
  await mountForm(el.querySelector('#nv-host'), {
    onDone: () => ctx.go('#/inicio'),
    onCancel: () => (history.length > 1 ? history.back() : ctx.go('#/inicio'))
  });
}
