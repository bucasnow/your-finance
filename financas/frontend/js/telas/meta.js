import { api } from '../api.js';
import { icon } from '../icons.js';
import { catIcon, confirmar, modal, ocupado, toast } from '../ui.js';
import { esc, mascaraValor, parseBRL } from '../utils.js';

// Categorias que contam como "comida" numa meta nova
const PADRAO = ['alimentacao', 'mercado'];
const chave = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Cria ou edita a meta semanal. `meta` nulo = nova. */
export function abrirMeta(meta, cats, depois) {
  const despesas = cats.filter((c) => c.tipo === 'despesa');
  const escolhidas = new Set(meta ? meta.categorias : despesas.filter((c) => PADRAO.includes(chave(c.nome))).map((c) => c.id));

  const { el, fechar } = modal(meta ? 'Meta semanal' : 'Nova meta semanal', `
    <form novalidate class="form-col">
      <label class="field"><span class="field-label">Nome</span>
        <input class="input" id="mt-nome" type="text" maxlength="40" value="${esc(meta?.nome || 'Comida')}"></label>
      <label class="field"><span class="field-label">Quanto quero gastar por semana</span>
        <div class="amount"><span>R$</span><input id="mt-valor" type="text" inputmode="numeric" placeholder="600,00" autocomplete="off"></div></label>
      <div class="field"><span class="field-label">Categorias que contam</span>
        <div class="cat-grid" id="mt-cats">
          ${despesas.map((c) => `<button type="button" class="tile ${escolhidas.has(c.id) ? 'on' : ''}" data-id="${c.id}" aria-pressed="${escolhidas.has(c.id)}">${catIcon(c, 17)}${esc(c.nome)}</button>`).join('')}
        </div></div>
      <p class="muted small">A semana vai de segunda a domingo.</p>
      <div class="form-error" role="alert"></div>
      <button class="btn btn-primary btn-block" type="submit">${icon('check', 18, 2.6)}Salvar meta</button>
      ${meta ? `<button class="btn btn-perigo-ghost btn-block" type="button" id="mt-excluir">${icon('lixo', 18)}Excluir meta</button>` : ''}
    </form>`);

  const valor = el.querySelector('#mt-valor');
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
    const dados = { nome: el.querySelector('#mt-nome').value.trim() || 'Comida', valor: parseBRL(valor.value), categorias: [...escolhidas] };
    if (dados.valor <= 0) { erro.textContent = 'Informe quanto quer gastar por semana.'; valor.focus(); return; }
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
