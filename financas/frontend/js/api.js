import { mock } from './mock.js';
import { monthKey, today } from './utils.js';

const cfg = () => window.FIN_CONFIG;

async function req(path, opts = {}) {
  const token = await cfg().getToken();
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const res = await fetch(cfg().apiBase + path, { ...opts, headers: { ...headers, ...opts.headers } });
  if (res.status === 401) { localStorage.removeItem('finapp_token'); window.location.reload(); return; }
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = j.detail || j.message || msg; } catch (_) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

function adaptTransacao(t) {
  return {
    id: t.id,
    data: t.data,
    descricao: t.descricao,
    categoria_id: t.categoria_id || 'outros',
    forma_pagamento_id: t.forma_pagamento_id || 'pix',
    valor: t.valor,
    tipo: t.tipo === 'CREDIT' ? 'receita' : 'despesa',
    total_parcelas: 1,
    parcela_atual: 1,
  };
}

export async function getCategorias() {
  if (cfg().useMock) return mock.categorias();
  const data = await req('/categorias');
  if (!data || !data.length) return mock.categorias();
  return data.map((c) => ({
    id: c.id,
    nome: c.nome,
    icone: c.icone || 'outros',
    cor: c.cor || '#94A3B8'
  }));
}

export async function getFormas() {
  if (cfg().useMock) return mock.formasPagamento();
  return mock.formasPagamento();
}

export const api = {
  async dashboard() {
    if (cfg().useMock) return mock.dashboard();
    const mes = monthKey(today());
    const [resumo, evolucao, recentes, categorias] = await Promise.all([
      req(`/transacoes/resumo?mes=${mes}`),
      req('/transacoes/evolucao-mensal?meses=6'),
      req('/transacoes?limit=8'),
      req('/categorias').catch(() => []),
    ]);
    const despesas = resumo?.total_despesas ?? 0;
    const receitas = resumo?.total_receitas ?? 0;
    const por_categoria = (resumo?.por_categoria || []).map((c) => ({
      categoria_id: c.categoria_id || 'outros',
      valor: c.total
    }));
    return {
      receitas,
      despesas,
      orcamento: cfg().orcamentoPadrao,
      por_categoria,
      recentes: (recentes || []).map(adaptTransacao),
      evolucao: (evolucao || []).map((e) => ({ mes: e.mes + '-01', valor: e.total_despesas || e.total || 0 })),
    };
  },

  async lancamentos(mes) {
    if (cfg().useMock) return mock.lancamentos().filter((t) => t.data.startsWith(mes));
    const data = await req(`/transacoes?mes=${mes}&limit=200`);
    return (data || []).map(adaptTransacao);
  },

  async criarLancamento(payload) {
    if (cfg().useMock) { mock.lancamentos().unshift({ id: Date.now().toString(), ...payload }); return; }
    return req('/transacoes', {
      method: 'POST',
      body: JSON.stringify({
        descricao: payload.descricao,
        valor: payload.valor,
        tipo: payload.tipo === 'receita' ? 'CREDIT' : 'DEBIT',
        data: payload.data,
        categoria_id: payload.categoria_id || null,
      }),
    });
  },

  async cartoes() {
    if (cfg().useMock) return mock.cartoes();
    return mock.cartoes();
  },

  async fatura(id) {
    if (cfg().useMock) return mock.fatura(id);
    return mock.fatura(id);
  },

  async investimentos() {
    if (cfg().useMock) return mock.investimentos();
    return mock.investimentos();
  },
};
