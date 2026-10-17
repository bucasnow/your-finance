import { api } from '../api.js';
import { icon } from '../icons.js';
import { confirmar, FORMAS, modal, ocupado, toast } from '../ui.js';
import { esc, mascaraValor, parseBRL } from '../utils.js';

export function abrirEdicao(t, cats, depois) {
  const doTipo = cats.filter((c) => c.tipo === t.tipo);
  const parcelado = t.total_parcelas > 1;

  const { el, fechar } = modal(t.tipo === 'receita' ? 'Editar receita' : 'Editar despesa', `
    <form novalidate class="form-col">
      <label class="field"><span class="field-label">Valor${parcelado ? ' desta parcela' : ''}</span>
        <div class="amount"><span>R$</span><input id="ed-valor" type="text" inputmode="numeric" autocomplete="off"></div></label>
      <label class="field"><span class="field-label">Descrição</span>
        <input class="input" id="ed-desc" type="text" maxlength="120" value="${esc(t.descricao)}"></label>
      <label class="field"><span class="field-label">Categoria</span>
        <select class="input" id="ed-cat">
          <option value="">Sem categoria</option>
          ${doTipo.map((c) => `<option value="${c.id}" ${c.id === t.categoria_id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
        </select></label>
      <label class="field"><span class="field-label">Data</span>
        <input class="input" id="ed-data" type="date" value="${t.data}"></label>
      <p class="muted small">${FORMAS[t.forma_pagamento] || ''}${parcelado ? ` · parcela ${t.parcela_atual} de ${t.total_parcelas}` : ''}</p>
      <div class="form-error" role="alert"></div>
      <button class="btn btn-primary btn-block" type="submit">${icon('check', 18, 2.6)}Salvar</button>
      <button class="btn btn-perigo-ghost btn-block" type="button" id="ed-excluir">${icon('lixo', 18)}Excluir</button>
    </form>`);

  const valor = el.querySelector('#ed-valor');
  mascaraValor(valor, t.valor);
  const erro = el.querySelector('.form-error');

  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = {
      descricao: el.querySelector('#ed-desc').value.trim(),
      valor: parseBRL(valor.value),
      data: el.querySelector('#ed-data').value,
      categoria_id: el.querySelector('#ed-cat').value || null,
    };
    if (dados.valor <= 0) { erro.textContent = 'Informe um valor maior que zero.'; return; }
    if (!dados.descricao) { erro.textContent = 'Informe uma descrição.'; return; }
    if (!dados.data) { erro.textContent = 'Informe a data.'; return; }
    const btn = e.submitter;
    ocupado(btn, true);
    try {
      await api.editarLancamento(t.id, dados);
      fechar();
      toast('Lançamento atualizado');
      depois();
    } catch (ex) {
      erro.textContent = ex.message;
      ocupado(btn, false);
    }
  });

  el.querySelector('#ed-excluir').addEventListener('click', async () => {
    fechar();
    const escolha = parcelado
      ? await confirmar('Excluir parcelado', `"${t.descricao}" tem ${t.total_parcelas} parcelas.`, [
        { valor: 'uma', rotulo: 'Excluir só esta parcela', perigo: true },
        { valor: 'todas', rotulo: `Excluir as ${t.total_parcelas} parcelas`, perigo: true },
      ])
      : await confirmar('Excluir lançamento', `Excluir "${t.descricao}"? Isso não pode ser desfeito.`, [{ valor: 'uma', rotulo: 'Excluir', perigo: true }]);
    if (!escolha) return;
    try {
      await api.excluirLancamento(t.id, escolha === 'todas');
      toast('Lançamento excluído');
      depois();
    } catch (ex) {
      toast(ex.message, 'erro');
    }
  });
}
