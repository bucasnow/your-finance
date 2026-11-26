import { api } from '../api.js';
import { icon } from '../icons.js';
import { catIcon, confirmar, modal, ocupado, toast } from '../ui.js';
import { esc, mascaraValor, parseBRL } from '../utils.js';

// Categorias que contam como "comida" numa meta nova
const PADRAO = ['alimentacao', 'mercado'];
const chave = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const hojeISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/** Tipo do período na tela: semanal, quinzenal, várias semanas ou mensal. */
const tipoDe = (m) => (!m || m.periodo !== 'mes' ? ((m?.semanas || 1) === 1 ? 'semana' : (m.semanas === 2 ? 'quinzena' : 'semanas')) : 'mes');
const PALAVRA = { semana: 'semana', quinzena: 'quinzena', semanas: 'período', mes: 'mês' };

/** Nome curto do período de uma meta ("semana", "quinzena", "3 semanas", "mês"). */
export function nomePeriodo(m) {
  return m.nome_periodo || PALAVRA[tipoDe(m)];
}

/** Cria ou edita uma meta. `meta` nulo = nova. */
export function abrirMeta(meta, cats, depois) {
  const despesas = cats.filter((c) => c.tipo === 'despesa');
  const escolhidas = new Set(meta ? meta.categorias : despesas.filter((c) => PADRAO.includes(chave(c.nome))).map((c) => c.id));

  let tipo = tipoDe(meta);
  const { el, fechar } = modal(meta ? 'Editar meta' : 'Nova meta', `
    <form novalidate class="form-col">
      <label class="field"><span class="field-label">Nome</span>
        <input class="input" id="mt-nome" type="text" maxlength="40" placeholder="Ex.: Comida, Uber, Lazer" value="${esc(meta?.nome || 'Comida')}"></label>
      <div class="field"><span class="field-label">Período</span>
        <div class="seg" id="mt-periodo" role="radiogroup" aria-label="Período">
          ${[['semana', 'Semanal'], ['quinzena', 'Quinzenal'], ['semanas', 'Semanas'], ['mes', 'Mensal']].map(([v, r]) =>
            `<button type="button" role="radio" data-v="${v}" class="${tipo === v ? 'on' : ''}" aria-checked="${tipo === v}">${r}</button>`).join('')}
        </div></div>
      <div class="dois" id="mt-semanas-linha">
        <label class="field" id="mt-n-campo"><span class="field-label">Quantas semanas</span>
          <input class="input" id="mt-n" type="number" min="3" max="8" value="${meta && meta.semanas > 2 ? meta.semanas : 3}"></label>
        <label class="field"><span class="field-label">Começa em</span>
          <input class="input" id="mt-inicio" type="date" value="${meta?.inicio || hojeISO()}"></label>
      </div>
      <label class="field"><span class="field-label" id="mt-valor-rotulo">Quanto quero gastar por semana</span>
        <div class="amount"><span>R$</span><input id="mt-valor" type="text" inputmode="numeric" placeholder="600,00" autocomplete="off"></div></label>
      <div class="field"><span class="field-label">Categorias que contam</span>
        <div class="cat-grid" id="mt-cats">
          ${despesas.map((c) => `<button type="button" class="tile ${escolhidas.has(c.id) ? 'on' : ''}" data-id="${c.id}" aria-pressed="${escolhidas.has(c.id)}">${catIcon(c, 17)}${esc(c.nome)}</button>`).join('')}
        </div></div>
      <p class="muted small" id="mt-dica"></p>
      <div class="form-error" role="alert"></div>
      <button class="btn btn-primary btn-block" type="submit">${icon('check', 18, 2.6)}Salvar meta</button>
      ${meta ? `<button class="btn btn-perigo-ghost btn-block" type="button" id="mt-excluir">${icon('lixo', 18)}Excluir meta</button>` : ''}
    </form>`);

  const valor = el.querySelector('#mt-valor');
  function atualizarPeriodo() {
    el.querySelectorAll('#mt-periodo [data-v]').forEach((b) => { b.classList.toggle('on', b.dataset.v === tipo); b.setAttribute('aria-checked', b.dataset.v === tipo); });
    el.querySelector('#mt-semanas-linha').hidden = !['quinzena', 'semanas'].includes(tipo);
    el.querySelector('#mt-n-campo').hidden = tipo !== 'semanas';
    el.querySelector('#mt-valor-rotulo').textContent = `Quanto quero gastar por ${PALAVRA[tipo]}`;
    el.querySelector('#mt-dica').textContent = {
      semana: 'A semana vai de segunda a domingo e recomeça toda segunda.',
      quinzena: 'Cada período tem 2 semanas, de segunda a domingo, contadas a partir da data de início.',
      semanas: 'Cada período tem o número de semanas escolhido, contado a partir da data de início.',
      mes: 'Vale o mês do calendário (do dia 1 ao último dia).',
    }[tipo] + ' Conta a data da compra, não a da fatura.';
  }
  el.querySelector('#mt-periodo').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (b) { tipo = b.dataset.v; atualizarPeriodo(); }
  });
  atualizarPeriodo();
  mascaraValor(valor, meta?.valor || 0);
  const erro = el.querySelector('.form-error');

  el.querySelector('#mt-cats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    if (escolhidas.has(b.dataset.id)) escolhidas.delete(b.dataset.id); else escolhidas.add(b.dataset.id);
    b.classList.toggle('on', escolhidas.has(b.dataset.id));
    b.setAttribute('aria-pressed', escolhidas.has(b.dataset.id));
  });

  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const n = Math.min(8, Math.max(3, Number(el.querySelector('#mt-n').value) || 3));
    const dados = {
      nome: el.querySelector('#mt-nome').value.trim() || 'Meta', valor: parseBRL(valor.value), categorias: [...escolhidas],
      periodo: tipo === 'mes' ? 'mes' : 'semana',
      semanas: tipo === 'quinzena' ? 2 : tipo === 'semanas' ? n : 1,
      inicio: ['quinzena', 'semanas'].includes(tipo) ? (el.querySelector('#mt-inicio').value || hojeISO()) : null,
    };
    if (dados.valor <= 0) { erro.textContent = `Informe quanto quer gastar por ${PALAVRA[tipo]}.`; valor.focus(); return; }
    if (!dados.categorias.length) { erro.textContent = 'Escolha pelo menos uma categoria.'; return; }
    const btn = e.submitter;
    ocupado(btn, true, 'Salvando…');
    try {
      if (meta) await api.editarMeta(meta.id, dados); else await api.criarMeta(dados);
      fechar();
      toast('Meta salva');
      depois();
    } catch (ex) {
      erro.textContent = ex.message;
      ocupado(btn, false);
    }
  });

  el.querySelector('#mt-excluir')?.addEventListener('click', async () => {
    fechar();
    if (!await confirmar('Excluir meta', `Excluir a meta "${meta.nome}"? Seus lançamentos não mudam.`, [{ valor: true, rotulo: 'Excluir meta', perigo: true }])) return;
    try {
      await api.excluirMeta(meta.id);
      toast('Meta excluída');
      depois();
    } catch (ex) {
      toast(ex.message, 'erro');
    }
  });
}
