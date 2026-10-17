import { api } from '../api.js';
import { icon } from '../icons.js';
import { catIcon, FORMAS, ocupado, toast } from '../ui.js';
import { brl, esc, hojeISO, mascaraValor, ontemISO, parseBRL } from '../utils.js';

export async function render(el, ctx) {
  const [cats, cartoes] = await Promise.all([api.categorias(), api.cartoes().catch(() => [])]);
  if (!ctx.atual()) return;

  const s = {
    tipo: ctx.params.get('tipo') === 'receita' ? 'receita' : 'despesa',
    categoria_id: null,
    quando: 'hoje',
    forma: 'pix',
    cartao_id: cartoes[0]?.id || null,
    parcelas: 1,
  };

  el.innerHTML = `
    <form class="form-novo card" novalidate>
      <h1 class="page-title" style="font-size:22px">Novo lançamento</h1>

      <div class="seg seg-tipo" id="nv-tipo" role="radiogroup" aria-label="Tipo">
        <button type="button" data-v="despesa">${icon('desce', 16, 2.4)}Despesa</button>
        <button type="button" data-v="receita">${icon('sobe', 16, 2.4)}Receita</button>
      </div>

      <label class="field"><span class="field-label">Valor</span>
        <div class="amount"><span>R$</span><input id="nv-valor" type="text" inputmode="numeric" placeholder="0,00" autocomplete="off"></div></label>

      <label class="field"><span class="field-label">Descrição</span>
        <input class="input" id="nv-desc" type="text" maxlength="120" placeholder="Ex.: Mercado da semana"></label>

      <div class="field"><span class="field-label">Categoria</span>
        <div class="cat-grid" id="nv-cat" role="radiogroup" aria-label="Categoria"></div></div>

      <div class="field"><span class="field-label">Data</span>
        <div class="opt-row" id="nv-quando">
          <button type="button" class="chip" data-v="hoje">Hoje</button>
          <button type="button" class="chip" data-v="ontem">Ontem</button>
          <button type="button" class="chip" data-v="outra">Outra data</button>
        </div>
        <input class="input" id="nv-data" type="date" value="${hojeISO()}" hidden></div>

      <div class="field"><span class="field-label">Forma de pagamento</span>
        <div class="opt-row" id="nv-forma"></div></div>

      <div class="field" id="nv-credito" hidden>
        ${cartoes.length ? `
          <span class="field-label">Cartão</span>
          <select class="input" id="nv-cartao">${cartoes.map((c) => `<option value="${c.id}">${esc(c.nome)}${c.final ? ` •••• ${esc(c.final)}` : ''}</option>`).join('')}</select>
          <span class="field-label" style="margin-top:8px">Parcelas</span>
          <select class="input" id="nv-parcelas">${Array.from({ length: 24 }, (_, i) => `<option value="${i + 1}">${i + 1}x</option>`).join('')}</select>
          <span class="muted small" id="nv-parcela-info"></span>`
          : `<div class="aviso">Você ainda não tem cartões cadastrados. <a href="#/cartoes" class="strong">Cadastrar cartão</a></div>`}
      </div>

      <div class="form-error" role="alert"></div>
      <button class="btn btn-primary btn-block" type="submit">${icon('check', 20, 2.6)}Salvar</button>
    </form>`;

  const $ = (q) => el.querySelector(q);
  const valor = $('#nv-valor');
  mascaraValor(valor);

  function atualizar() {
    el.querySelectorAll('#nv-tipo button').forEach((b) => b.classList.toggle('on', b.dataset.v === s.tipo));
    $('#nv-tipo').dataset.tipo = s.tipo;

    const doTipo = cats.filter((c) => c.tipo === s.tipo);
    if (!doTipo.some((c) => c.id === s.categoria_id)) s.categoria_id = null;
    $('#nv-cat').innerHTML = doTipo.map((c) => `
      <button type="button" class="tile ${c.id === s.categoria_id ? 'on' : ''}" role="radio" aria-checked="${c.id === s.categoria_id}" data-id="${c.id}">${catIcon(c, 17)}${esc(c.nome)}</button>`).join('');

    if (s.tipo === 'receita' && s.forma === 'credito') s.forma = 'pix';
    const formas = Object.entries(FORMAS).filter(([k]) => s.tipo === 'despesa' || k !== 'credito');
    $('#nv-forma').innerHTML = formas.map(([k, nome]) => `<button type="button" class="chip ${k === s.forma ? 'on' : ''}" data-v="${k}">${nome}</button>`).join('');

    el.querySelectorAll('#nv-quando .chip').forEach((b) => b.classList.toggle('on', b.dataset.v === s.quando));
    $('#nv-data').hidden = s.quando !== 'outra';
    $('#nv-credito').hidden = s.forma !== 'credito';
    infoParcela();
  }

  function infoParcela() {
    const info = $('#nv-parcela-info');
    if (!info) return;
    const total = parseBRL(valor.value);
    info.textContent = s.parcelas > 1 && total > 0 ? `${s.parcelas}x de R$ ${brl(total / s.parcelas)} · uma parcela por mês na fatura` : '';
  }

  $('#nv-tipo').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { s.tipo = b.dataset.v; atualizar(); } });
  $('#nv-cat').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) { s.categoria_id = b.dataset.id; atualizar(); } });
  $('#nv-quando').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { s.quando = b.dataset.v; atualizar(); } });
  $('#nv-forma').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { s.forma = b.dataset.v; atualizar(); } });
  $('#nv-cartao')?.addEventListener('change', (e) => { s.cartao_id = e.target.value; });
  $('#nv-parcelas')?.addEventListener('change', (e) => { s.parcelas = Number(e.target.value); infoParcela(); });
  valor.addEventListener('input', infoParcela);

  $('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const erro = $('.form-error');
    const dados = {
      tipo: s.tipo,
      valor: parseBRL(valor.value),
      descricao: $('#nv-desc').value.trim(),
      categoria_id: s.categoria_id,
      data: s.quando === 'hoje' ? hojeISO() : s.quando === 'ontem' ? ontemISO() : $('#nv-data').value,
      forma_pagamento: s.forma,
      cartao_id: s.forma === 'credito' ? s.cartao_id : null,
      parcelas: s.forma === 'credito' ? s.parcelas : 1,
    };
    if (dados.valor <= 0) { erro.textContent = 'Informe um valor maior que zero.'; valor.focus(); return; }
    if (!dados.descricao) { erro.textContent = 'Informe uma descrição.'; $('#nv-desc').focus(); return; }
    if (!dados.data) { erro.textContent = 'Escolha a data.'; return; }
    if (dados.forma_pagamento === 'credito' && !dados.cartao_id) { erro.textContent = 'Cadastre um cartão para lançar no crédito.'; return; }
    erro.textContent = '';
    const btn = e.submitter;
    ocupado(btn, true, 'Salvando…');
    try {
      await api.criarLancamento(dados);
      toast(s.tipo === 'receita' ? 'Receita salva' : 'Despesa salva');
      ctx.ir('#/inicio');
    } catch (ex) {
      erro.textContent = ex.message;
      ocupado(btn, false);
    }
  });

  atualizar();
  if (!matchMedia('(pointer: coarse)').matches) valor.focus();
}
