// Peças comuns de Investimentos e Objetivos: escolher como rende, taxas do dia e projeção.
import { esc, money } from './utils.js';

// Rótulo e exemplo do campo de taxa de cada indexador (sem campo = não precisa de taxa)
export const CAMPO_TAXA = {
  cdi: { rotulo: '% do CDI', exemplo: '100', padrao: 100 },
  cdi_mais: { rotulo: 'Taxa extra ao ano (%)', exemplo: '2', padrao: 2 },
  prefixado: { rotulo: 'Taxa ao ano (%)', exemplo: '12,5', padrao: 12 },
  ipca_mais: { rotulo: 'Taxa acima do IPCA, ao ano (%)', exemplo: '6', padrao: 6 },
};

const numero = (s) => Number(String(s ?? '').replace(/\./g, '').replace(',', '.'));
const fmt = (v, casas = 2) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas });

/** Campos "Como rende" + taxa. `indexadores` = { chave: nome }. */
export function camposRendimento(indexadores, atual = 'cdi', taxa = null, prefixo = 'rd') {
  return `
    <div class="dois rendimento-campos">
      <label class="field"><span class="field-label">Como rende</span>
        <select class="input" id="${prefixo}-index">
          ${Object.entries(indexadores).map(([k, n]) => `<option value="${k}" ${k === atual ? 'selected' : ''}>${esc(n)}</option>`).join('')}
        </select></label>
      <label class="field" id="${prefixo}-taxa-campo"><span class="field-label" id="${prefixo}-taxa-rotulo">Taxa</span>
        <input class="input" id="${prefixo}-taxa" type="text" inputmode="decimal" value="${taxa != null ? fmt(taxa, 4) : ''}"></label>
    </div>`;
}

/** Mostra/esconde a taxa conforme o indexador; devolve uma função que lê { indexador, taxa }. */
export function ligarRendimento(raiz, prefixo = 'rd', aoMudar = () => {}) {
  const sel = raiz.querySelector(`#${prefixo}-index`);
  const campo = raiz.querySelector(`#${prefixo}-taxa-campo`);
  const input = raiz.querySelector(`#${prefixo}-taxa`);
  const atualizar = () => {
    const c = CAMPO_TAXA[sel.value];
    campo.hidden = !c;
    if (c) {
      raiz.querySelector(`#${prefixo}-taxa-rotulo`).textContent = c.rotulo;
      input.placeholder = `Ex.: ${c.exemplo}`;
      if (!input.value) input.value = fmt(c.padrao);
    }
    aoMudar(sel.value);
  };
  sel.addEventListener('change', () => { input.value = ''; atualizar(); });
  atualizar();
  return () => ({ indexador: sel.value, taxa: CAMPO_TAXA[sel.value] ? numero(input.value) : null });
}

/** "CDI 14,9% · Selic 15% · IPCA 4,5% (12 meses) · Banco Central, 26/11". */
export function faixaTaxas(t) {
  if (!t) return '';
  const quando = t.data ? ` · ${t.data.slice(8, 10)}/${t.data.slice(5, 7)}` : '';
  return `
    <div class="faixa-taxas small ${t.oficial ? '' : 'aviso-leve'}">
      <span>CDI <strong>${fmt(t.cdi_aa)}%</strong></span>
      <span>Selic <strong>${fmt(t.selic_aa)}%</strong></span>
      <span>IPCA 12m <strong>${fmt(t.ipca_12m)}%</strong></span>
      <span class="muted">${t.oficial ? `Banco Central${quando}` : 'estimativa — Banco Central fora do ar agora'}</span>
    </div>`;
}

/** Valor futuro com aporte no fim de cada mês (mesma conta do servidor). */
export function projetar(valor, anual, meses, aporte = 0) {
  const i = (1 + (anual || 0) / 100) ** (1 / 12) - 1;
  if (!i) return valor + aporte * meses;
  return valor * (1 + i) ** meses + aporte * (((1 + i) ** meses - 1) / i);
}

export const PRAZOS = [[6, '6 meses'], [12, '1 ano'], [24, '2 anos'], [60, '5 anos'], [120, '10 anos']];

/** Tabela de projeção: prazo, valor, quanto rendeu no período. */
export function tabelaProjecao(linhas) {
  return `
    <div class="projecao">
      ${linhas.map((l) => `
        <div class="projecao-linha"><span class="muted">${l.rotulo}</span>
          <strong>${money(l.valor)}</strong>
          <span class="small pos">${l.ganho >= 0 ? '+' : '−'} ${money(Math.abs(l.ganho))}</span></div>`).join('')}
    </div>`;
}
