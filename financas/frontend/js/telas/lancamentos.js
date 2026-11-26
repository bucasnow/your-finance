import { api } from '../api.js';
import { icon } from '../icons.js';
import { abrirEdicao } from './lancamento-edicao.js';
import { abrirCategoria, abrirGastosMeta, ligarQuadro, quadroCategorias } from './categorias-gasto.js';
import { mesDaTela, visaoAtual } from '../estado.js';
import { ligarNavMes, ligarVisao, navMes, seletorVisao } from '../mes-nav.js';
import { categoriaPorId, linhaLancamento, toast } from '../ui.js';
import { brl, ddmm, esc, groupBy, mesAtual, mesValido, money, nomeMes, rotuloDia, somarMeses } from '../utils.js';

const filtro = { tipo: '', busca: '' };

/** Resultado das metas nos períodos do mês (ex.: as semanas de novembro). */
function quadroMetas(r) {
  if (!r?.metas?.length) {
    return `<article class="card span-2" id="lc-metas"><h2 class="card-title">Metas do mês</h2>
      <p class="muted small">Você ainda não tem metas. Defina uma no Início (ex.: R$ 600 por semana com comida) para acompanhar aqui como foi cada período.</p>
      <a class="btn btn-ghost" href="#/inicio">Ir para o Início</a></article>`;
  }
  return `
    <article class="card span-2" id="lc-metas">
      <h2 class="card-title">Metas do mês</h2>
      ${r.metas.map((m) => `
        <div class="lc-meta">
          <div class="lc-meta-topo"><strong>${esc(m.nome)}</strong>
            <span class="muted small">${money(m.valor)} por ${esc(m.nome_periodo)} · no mês ${money(m.total_mes)}</span></div>
          ${m.periodos.map((p, i) => {
            const pctUso = m.valor ? (p.gasto / m.valor) * 100 : 0;
            const cor = pctUso > 100 ? 'var(--neg)' : pctUso > 80 ? 'var(--warn)' : 'var(--accent)';
            const rotulo = m.periodo === 'mes' ? nomeMes(p.inicio.slice(0, 7)) : `${{ semana: 'Semana', quinzena: 'Quinzena' }[m.nome_periodo] || 'Período'} ${i + 1}`;
            return `
            <button type="button" class="lc-periodo ${p.futuro ? 'futuro' : ''}" data-meta-periodo="${m.id}" data-inicio="${p.inicio}" ${p.futuro ? 'disabled' : ''} aria-label="Ver gastos de ${esc(m.nome)} em ${rotulo}">
              <span class="lc-periodo-nome">${rotulo} <span class="muted small">${ddmm(p.inicio)}–${ddmm(p.fim)}</span>
                ${p.em_andamento ? '<span class="badge">em andamento</span>' : ''}</span>
              <span class="bar"><span style="width:${Math.min(100, pctUso)}%;background:${cor}"></span></span>
              <span class="${pctUso > 100 ? 'neg' : ''} strong">${p.futuro ? '—' : money(p.gasto)}</span>
            </button>`;
          }).join('')}
        </div>`).join('')}
    </article>`;
}

export async function render(el, ctx) {
  const mes = mesDaTela(ctx.params);       // o mesmo mês das abas Início e Cartões
  const visao = visaoAtual(ctx.params);
  if (ctx.params.has('busca')) filtro.busca = ctx.params.get('busca');   // vindo da busca do topo
  // Busca do topo sem mês escolhido: procura em todos os meses
  const todosMeses = !!ctx.params.get('busca') && !mesValido(ctx.params.get('mes'));
  const [txs, cats, cartoes, recs, resumo, metasMes] = await Promise.all([
    todosMeses ? api.todosLancamentos() : api.lancamentos(mes, visao),
    api.categorias(), api.cartoes().catch(() => []), api.recorrencias().catch(() => []),
    todosMeses ? null : api.resumo(mes, visao).catch(() => null),
    todosMeses ? null : api.metasDoMes(mes).catch(() => null),
  ]);
  if (!ctx.atual()) return;

  const cat = categoriaPorId(cats);
  const mapaCartoes = new Map(cartoes.map((c) => [c.id, c]));
  const recorrencias = new Map(recs.map((r) => [r.id, r]));
  // Totais do mês pela mesma conta do Início (pagamento de fatura não é gasto; vale o valor oficial)
  const receitas = resumo ? resumo.receitas : txs.filter((t) => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0);
  const despesas = resumo ? resumo.despesas : txs.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0);
  const competencia = visao === 'competencia';

  el.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">Lançamentos</h1>
      <div class="acoes-linha">
        <a href="#/importar" class="btn btn-ghost btn-compacto">${icon('importar', 18, 2.2)}Importar fatura</a>
        <a href="#/novo" class="icon-btn destaque" aria-label="Novo lançamento">${icon('mais', 22, 2.4)}</a>
      </div>
    </header>

    ${todosMeses ? `
    <div class="month-nav">
      <span class="strong" style="padding-left:10px">Buscando em todos os meses</span>
      <a href="#/lancamentos" class="btn btn-ghost btn-compacto">Ver por mês</a>
    </div>` : `
    ${navMes({ mes, link: (m) => `#/lancamentos?mes=${m}` })}
    <div class="visao-linha">
      ${seletorVisao(visao)}
      <span class="small muted">${competencia ? 'Lançamentos pela data da compra.' : 'O que você paga no mês: no cartão, a fatura que vence no mês.'}</span>
    </div>`}

    ${todosMeses ? '' : `<section class="card summary-row">
      <div class="info"><span class="muted small">Receitas</span><strong class="pos">${money(receitas)}</strong></div>
      <div class="info"><span class="muted small">Despesas</span><strong class="neg">${money(despesas)}</strong></div>
      <div class="info"><span class="muted small">Saldo</span><strong class="${receitas - despesas < 0 ? 'neg' : ''}">${money(receitas - despesas)}</strong></div>
    </section>`}

    ${todosMeses ? '' : `
    <section class="grid-3 lc-paineis">
      ${resumo ? quadroCategorias({ id: 'lc-categorias', titulo: 'Gastos por categoria', itens: resumo.por_categoria, total: resumo.despesas, cat,
        dica: resumo.por_categoria.length ? 'Toque numa categoria para ver os lançamentos.' : '' }) : ''}
      ${quadroMetas(metasMes)}
    </section>`}

    <div class="filtros-linha">
      <div class="seg" id="lc-tipo">
        <button type="button" data-v="">Todos</button>
        <button type="button" data-v="despesa">Despesas</button>
        <button type="button" data-v="receita">Receitas</button>
      </div>
      <label class="busca">${icon('busca', 16)}<input type="search" id="lc-busca" placeholder="Buscar" value="${filtro.busca.replace(/"/g, '&quot;')}" aria-label="Buscar lançamento"></label>
    </div>

    <section class="card lista-card" id="lc-lista"></section>`;

  const lista = el.querySelector('#lc-lista');
  if (resumo) {
    ligarQuadro(el.querySelector('#lc-categorias'), {
      itens: resumo.por_categoria, cat,
      aoEscolher: async (categoriaId) => {
        try {
          const d = await api.lancamentosDaCategoria(mes, visao, categoriaId);
          abrirCategoria({ categoria: cat(categoriaId), periodo: nomeMes(mes), total: d.total, lancamentos: d.lancamentos,
            ajuste: d.ajuste_valor_oficial, cat, cats, cartoes, depois: ctx.recarregar });
        } catch (e) { toast(e.message, 'erro'); }
      },
    });
  }
  if (ctx.params.get('ver') === 'metas') el.querySelector('#lc-metas')?.scrollIntoView({ block: 'start' });
  if (!todosMeses) {
    ligarNavMes(el, { mes, link: (m) => `#/lancamentos?mes=${m}`, ir: ctx.ir, visao });
    ligarVisao(el, () => ctx.recarregar());
  }
  el.querySelector('#lc-metas')?.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-meta-periodo]');
    if (!b) return;
    try {
      const g = await api.gastosDaMeta(b.dataset.metaPeriodo, b.dataset.inicio);
      abrirGastosMeta({ g, cat, cats, cartoes, depois: ctx.recarregar });
    } catch (ex) { toast(ex.message, 'erro'); }
  });

  function desenhar() {
    el.querySelectorAll('#lc-tipo button').forEach((b) => b.classList.toggle('on', b.dataset.v === filtro.tipo));
    const termo = filtro.busca.trim().toLowerCase();
    const visiveis = txs.filter((t) => (!filtro.tipo || t.tipo === filtro.tipo)
      && (!termo || t.descricao.toLowerCase().includes(termo) || cat(t.categoria_id).nome.toLowerCase().includes(termo)));
    if (!visiveis.length) {
      lista.innerHTML = `<div class="empty">${txs.length ? 'Nenhum lançamento com esse filtro.' : 'Nenhum lançamento neste mês.'}</div>`;
      return;
    }
    const dias = groupBy(visiveis, (t) => t.data);
    lista.innerHTML = Object.keys(dias).sort((a, b) => b.localeCompare(a)).map((dia) => {
      const total = dias[dia].reduce((s, t) => s + (t.tipo === 'despesa' ? -t.valor : t.valor), 0);
      return `
        <div class="day-group">
          <div class="day-head"><span class="strong small">${rotuloDia(dia)}</span><span class="small muted">${total < 0 ? '−' : '+'} R$ ${brl(Math.abs(total))}</span></div>
          ${dias[dia].map((t) => linhaLancamento(t, cat(t.categoria_id), { cartoes: mapaCartoes, recorrencias })).join('')}
        </div>`;
    }).join('');
  }

  el.querySelector('#lc-tipo').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (b) { filtro.tipo = b.dataset.v; desenhar(); }
  });
  el.querySelector('#lc-busca').addEventListener('input', (e) => { filtro.busca = e.target.value; desenhar(); });
  lista.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tx]');
    const t = b && txs.find((x) => x.id === b.dataset.tx);
    if (t) abrirEdicao(t, cats, ctx.recarregar, { recorrencias });
  });

  desenhar();
  if (ctx.params.has('busca')) el.querySelector('#lc-busca').focus();
}
