import { api } from '../api.js';
import { icon } from '../icons.js';
import { confirmar, FORMAS, modal, ocupado, toast } from '../ui.js';
import { esc, mascaraValor, parseBRL } from '../utils.js';

export function abrirEdicao(t, cats, depois, { recorrencias } = {}) {
  const doTipo = cats.filter((c) => c.tipo === t.tipo);
  const parcelado = t.total_parcelas > 1;
  const rec = t.recorrencia_id ? recorrencias?.get(t.recorrencia_id) : null;
  const recAtiva = t.recorrencia_id && rec?.ativa !== false;
  const freqNome = rec?.frequencia === 'anual' ? 'anual' : 'mensal';

  // Recorrente: ativa → oferece parar; encerrada → só informa; avulsa → oferece tornar recorrente
  const blocoRecorrencia = parcelado ? '' : recAtiva ? `
      <div class="rec-box">
        <span class="strong">${icon('repete', 16, 2.2)}Recorrência ${rec ? freqNome : ''}</span>
        <span class="muted small">Os próximos lançamentos são criados automaticamente.</span>
        <button class="btn btn-ghost btn-block" type="button" id="ed-parar">Parar recorrência</button>
      </div>` : t.recorrencia_id ? `
      <p class="muted small">${icon('repete', 14, 2.2)} Recorrência encerrada</p>` : `
      <div class="rec-box">
        <button class="btn btn-ghost btn-block" type="button" id="ed-tornar">${icon('repete', 18, 2.2)}Tornar recorrente</button>
        <div id="ed-rec-opcoes" class="form-col" hidden>
          <div class="opt-row" id="ed-freq">
            <button type="button" class="chip on" data-v="mensal">Mensal</button>
            <button type="button" class="chip" data-v="anual">Anual</button>
          </div>
          <label class="field"><span class="field-label">Termina em (opcional)</span>
            <input class="input" id="ed-rec-fim" type="date"></label>
          <button class="btn btn-primary btn-block" type="button" id="ed-rec-ok">${icon('check', 18, 2.6)}Repetir a partir deste lançamento</button>
        </div>
      </div>`;

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
      ${blocoRecorrencia}
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

  let frequencia = 'mensal';
  el.querySelector('#ed-tornar')?.addEventListener('click', (e) => {
    e.currentTarget.hidden = true;
    el.querySelector('#ed-rec-opcoes').hidden = false;
  });
  el.querySelector('#ed-freq')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    frequencia = b.dataset.v;
    el.querySelectorAll('#ed-freq .chip').forEach((x) => x.classList.toggle('on', x === b));
  });
  el.querySelector('#ed-rec-ok')?.addEventListener('click', async (e) => {
    const fim = el.querySelector('#ed-rec-fim').value || null;
    if (fim && fim < t.data) { erro.textContent = 'A data de término deve ser depois deste lançamento.'; return; }
    const btn = e.currentTarget;
    ocupado(btn, true, 'Salvando…');
    try {
      await api.tornarRecorrente(t.id, { frequencia, data_fim: fim });
      fechar();
      toast(frequencia === 'anual' ? 'Agora repete todo ano' : 'Agora repete todo mês');
      depois();
    } catch (ex) {
      erro.textContent = ex.message;
      ocupado(btn, false);
    }
  });
  el.querySelector('#ed-parar')?.addEventListener('click', async () => {
    fechar();
    const ok = await confirmar('Parar recorrência', `"${t.descricao}" não vai mais se repetir. Os lançamentos futuros já criados serão apagados; os de hoje para trás continuam.`,
      [{ valor: true, rotulo: 'Parar recorrência', perigo: true }]);
    if (!ok) return;
    try {
      await api.pararRecorrencia(t.recorrencia_id);
      toast('Recorrência encerrada');
      depois();
    } catch (ex) {
      toast(ex.message, 'erro');
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
