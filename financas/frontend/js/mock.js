import { today, isoDate, monthKey, addMonths } from './utils.js';

const t = today();
const mesAtual = monthKey(t);

const CATS = [
  { id: 'alimentacao', nome: 'Alimentação', icone: 'food', cor: '#F59E0B' },
  { id: 'transporte', nome: 'Transporte', icone: 'car', cor: '#3B82F6' },
  { id: 'moradia', nome: 'Moradia', icone: 'home', cor: '#8B5CF6' },
  { id: 'saude', nome: 'Saúde', icone: 'heart', cor: '#EF4444' },
  { id: 'lazer', nome: 'Lazer', icone: 'smile', cor: '#EC4899' },
  { id: 'educacao', nome: 'Educação', icone: 'book', cor: '#06B6D4' },
  { id: 'compras', nome: 'Compras', icone: 'bag', cor: '#F97316' },
  { id: 'outros', nome: 'Outros', icone: 'outros', cor: '#94A3B8' },
  { id: 'receita', nome: 'Receita', icone: 'arrow-up', cor: '#34D399' },
];

const FORMAS = [
  { id: 'pix', nome: 'Pix' },
  { id: 'debito', nome: 'Débito' },
  { id: 'credito', nome: 'Crédito' },
  { id: 'dinheiro', nome: 'Dinheiro' },
  { id: 'ted', nome: 'TED' },
  { id: 'transferencia', nome: 'Transferência' },
];

function d(offset, cat, desc, valor, tipo = 'despesa', forma = 'pix') {
  const dt = new Date(t.getFullYear(), t.getMonth(), t.getDate() - offset);
  return { id: `m${offset}${cat}`, data: isoDate(dt), categoria_id: cat, descricao: desc, valor, tipo, forma_pagamento_id: forma, total_parcelas: 1, parcela_atual: 1 };
}

const TXS = [
  d(0, 'alimentacao', 'iFood — Pizza', 62.90),
  d(0, 'transporte', 'Uber', 18.50),
  d(1, 'alimentacao', 'Pão de Açúcar', 187.40),
  d(1, 'receita', 'Salário', 6800, 'receita', 'ted'),
  d(2, 'moradia', 'Aluguel', 1800, 'despesa', 'ted'),
  d(3, 'saude', 'Farmácia', 94.60),
  d(4, 'lazer', 'Netflix', 39.90),
  d(5, 'compras', 'Amazon — fone', 259.00, 'despesa', 'credito'),
  d(6, 'educacao', 'Udemy', 49.90),
  d(7, 'alimentacao', 'Restaurante', 78.00),
  d(8, 'transporte', 'Combustível', 120.00),
  d(9, 'outros', 'Barbeiro', 40.00),
  d(10, 'saude', 'Plano de saúde', 380.00),
  d(12, 'lazer', 'Spotify', 21.90),
  d(14, 'alimentacao', 'Supermercado', 213.50),
  d(15, 'receita', 'Freela', 800, 'receita', 'pix'),
];

function evol(n) {
  return Array.from({ length: n }, (_, i) => ({
    mes: monthKey(addMonths(new Date(t.getFullYear(), t.getMonth(), 1), i - n + 1)) + '-01',
    valor: 2800 + Math.round(Math.random() * 1800)
  }));
}

export const mock = {
  categorias: () => CATS,
  formasPagamento: () => FORMAS,
  dashboard: () => {
    const despesas = TXS.filter((t) => t.tipo === 'despesa').reduce((s, x) => s + x.valor, 0);
    const receitas = TXS.filter((t) => t.tipo === 'receita').reduce((s, x) => s + x.valor, 0);
    const por_categoria = CATS.filter((c) => c.id !== 'receita').map((c) => ({
      categoria_id: c.id,
      valor: TXS.filter((t) => t.categoria_id === c.id && t.tipo === 'despesa').reduce((s, x) => s + x.valor, 0)
    })).filter((c) => c.valor > 0).sort((a, b) => b.valor - a.valor);
    return { receitas, despesas, orcamento: 8500, por_categoria, recentes: TXS.slice(0, 8), evolucao: evol(6) };
  },
  lancamentos: () => TXS,
  cartoes: () => [
    { id: 'c1', nome: 'Nubank', final: '4521', estilo: 'nu', limite: 8000, limite_usado: 1850, fatura_atual: 1850, fechamento: '2026-10-25', vencimento: '2026-11-02' },
    { id: 'c2', nome: 'Inter', final: '7788', estilo: 'inter', limite: 5000, limite_usado: 620, fatura_atual: 620, fechamento: '2026-10-20', vencimento: '2026-10-27' }
  ],
  fatura: (id) => ({
    cartao: id === 'c1'
      ? { id: 'c1', nome: 'Nubank', final: '4521', estilo: 'nu', limite: 8000, limite_usado: 1850, fatura_atual: 1850, fechamento: '2026-10-25', vencimento: '2026-11-02' }
      : { id: 'c2', nome: 'Inter', final: '7788', estilo: 'inter', limite: 5000, limite_usado: 620, fatura_atual: 620, fechamento: '2026-10-20', vencimento: '2026-10-27' },
    mes: mesAtual + '-01',
    status: 'aberta',
    total: id === 'c1' ? 1850 : 620,
    proximas: [
      { mes: monthKey(addMonths(new Date(t.getFullYear(), t.getMonth(), 1), 1)) + '-01', valor: id === 'c1' ? 2100 : 500 },
      { mes: monthKey(addMonths(new Date(t.getFullYear(), t.getMonth(), 1), 2)) + '-01', valor: id === 'c1' ? 1950 : 700 },
    ],
    itens: TXS.filter((x) => x.forma_pagamento_id === 'credito').map((x) => ({ ...x, detalhe: 'crédito' }))
  }),
  investimentos: () => ({
    total: 48320,
    variacao_mes: 820,
    variacao_pct_6m: 12.4,
    evolucao: evol(6).map((e, i) => ({ ...e, valor: 38000 + i * 1800 + Math.round(Math.random() * 600) })),
    tipos: [
      { id: 'rf', nome: 'Renda Fixa', cor: '#34D399' },
      { id: 'rv', nome: 'Renda Variável', cor: '#3B82F6' },
      { id: 'fi', nome: 'Fundos', cor: '#8B5CF6' },
    ],
    ativos: [
      { id: 'a1', sigla: 'CDB', nome: 'CDB Banco Inter 115% CDI', tipo_id: 'rf', valor: 18000, rent_mes: 0.92 },
      { id: 'a2', sigla: 'LCI', nome: 'LCI Bradesco 98% CDI', tipo_id: 'rf', valor: 12000, rent_mes: 0.78 },
      { id: 'a3', sigla: 'MXRF11', nome: 'Maxi Renda FII', tipo_id: 'fi', valor: 8200, rent_mes: 1.1 },
      { id: 'a4', sigla: 'PETR4', nome: 'Petrobras PN', tipo_id: 'rv', valor: 6120, rent_mes: -0.4 },
      { id: 'a5', sigla: 'BOVA11', nome: 'iShares Ibovespa ETF', tipo_id: 'rv', valor: 4000, rent_mes: 0.3 },
    ],
    aportes: [
      { data: isoDate(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 2)), ativo: 'CDB Banco Inter', valor: 1000 },
      { data: isoDate(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 8)), ativo: 'MXRF11', valor: 500 },
      { data: isoDate(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 15)), ativo: 'LCI Bradesco', valor: 2000 },
    ]
  })
};
