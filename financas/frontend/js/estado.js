// Estado que vale para o site inteiro: o mês escolhido e a visão (caixa ou competência).
import { mesAtual, mesValido } from './utils.js';

const CHAVE_MES = 'fin.mes';       // só nesta sessão: ao abrir o site de novo, volta ao mês atual
const CHAVE_VISAO = 'fin.visao';   // lembrada entre visitas

export function mesGuardado() {
  try {
    const m = sessionStorage.getItem(CHAVE_MES);
    if (mesValido(m)) return m;
  } catch { /* modo privado */ }
  return mesAtual();
}

export function salvarMes(mes) {
  try { sessionStorage.setItem(CHAVE_MES, mes); } catch { /* modo privado */ }
}

/** Mês da tela: o do endereço (e passa a valer para as outras abas) ou o último escolhido. */
export function mesDaTela(params) {
  const m = params.get('mes');
  if (mesValido(m)) { salvarMes(m); return m; }
  return mesGuardado();
}

/** Caixa (o que se paga no mês, padrão) ou competência (data da compra), para o site inteiro. */
export function visaoAtual(params) {
  const v = params?.get('visao');
  if (v === 'caixa' || v === 'competencia') { salvarVisao(v); return v; }
  try { return localStorage.getItem(CHAVE_VISAO) === 'competencia' ? 'competencia' : 'caixa'; } catch { return 'caixa'; }
}

export function salvarVisao(v) {
  try { localStorage.setItem(CHAVE_VISAO, v); } catch { /* modo privado */ }
}
