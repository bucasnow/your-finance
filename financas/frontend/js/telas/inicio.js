import { api, sessao } from '../api.js';
import { comparativoChart } from '../charts.js';
import { abrirCategoria, abrirGastosMeta, ligarQuadro, quadroCategorias } from './categorias-gasto.js';
import { mesDaTela, salvarVisao, visaoAtual } from '../estado.js';
import { ligarNavMes, navMes } from '../mes-nav.js';
import { icon } from '../icons.js';
import { abrirEdicao } from './lancamento-edicao.js';
import { abrirMeta, nomePeriodo } from './meta.js';
import { catIcon, categoriaPorId, confirmar, linhaLancamento, toast } from '../ui.js';
import { brl, compact, ddmm, esc, mesAtual, mesCurto, mesValido, money, nomeMes, pct, somarMeses } from '../utils.js';

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function dataDeHoje() {
  const d = new Date();
  const texto = `${DIAS[d.getDay()]}, ${d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}`;
  return texto[0].toUpperCase() + texto.slice(1);
}

/** "A fatura do Visa vence em 3 dias (R$ 782,74)." — a próxima a vencer entre os cartões. */
function proximaFatura(cartoes) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const prox = cartoes
    .map((c) => ({ ...c, dias: Math.round((new Date(`${c.vencimento}T00:00:00`) - hoje) / 86400000) }))
    .filter((c) => c.dias >= 0 && c.fatura_atual > 0)
    .sort((a, b) => a.dias - b.dias)[0];
  if (!prox) return 'Suas finanças do mês, num lugar só.';
  const quando = prox.dias === 0 ? 'vence hoje' : prox.dias === 1 ? 'vence amanhã' : `vence em ${prox.dias} dias`;
  return `A fatura do ${esc(prox.nome)} ${quando} (${money(prox.fatura_atual)}).`;
}

const DIAS_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/** Cartão de uma meta: quanto já foi no período atual. O histórico fica na aba Lançamentos. */
function cardMeta(m) {
  const periodo = nomePeriodo(m);
  const fem = ['semana', 'quinzena'].includes(periodo);
  const cor = m.percentual > 100 ? 'var(--neg)' : m.percentual > 80 ? 'var(--warn)' : 'var(--accent)';
  const resto = m.dias_restantes > 0 && m.restante > 0
    ? `Faltam ${m.dias_restantes} dia${m.dias_restantes > 1 ? 's' : ''} ${fem ? 'nesta' : 'neste'} ${periodo} · dá uns ${money(m.restante / (m.dias_restantes + 1))} por dia, contando hoje`
    : m.dias_restantes > 0 ? `Faltam ${m.dias_restantes} dia${m.dias_restantes > 1 ? 's' : ''} ${fem ? 'nesta' : 'neste'} ${periodo}` : `Último dia ${fem ? 'da' : 'do'} ${periodo}`;
  return `
    <section class="card meta-card meta-clicavel" data-meta-abrir="${m.id}" tabindex="0" role="button" aria-label="Ver os gastos da meta ${esc(m.nome)}">
      <div class="card-head">
        <div><h2 class="card-title">${esc(m.nome)}</h2>
          <span class="muted small">${fem ? 'Nesta' : 'Neste'} ${periodo} · ${ddmm(m.periodo_inicio)} a ${ddmm(m.periodo_fim)}</span></div>
        <button class="icon-btn" type="button" data-meta-menu="${m.id}" aria-label="Opções da meta ${esc(m.nome)}" aria-haspopup="menu">
          <span class="tres-pontos" aria-hidden="true">⋯</span></button>
      </div>
      <div class="meta-topo">
        <div><span class="hero-val ${m.restante < 0 ? 'neg' : ''}" style="font-size:30px">${money(m.gasto)}</span>
          <span class="muted"> de ${money(m.valor)}</span></div>
        <span class="badge ${m.restante < 0 ? 'neg' : 'pos'}">${m.restante < 0 ? `Passou ${money(-m.restante)}` : `Pode gastar ${money(m.restante)}`}</span>
      </div>
      <div class="bar thick"><span style="width:${Math.min(100, m.percentual)}%;background:${cor}"></span></div>
      <p class="small muted">${resto}</p>
      ${m.por_dia?.length === 7 ? `
      <div class="meta-dias">
        ${DIAS_CURTOS.map((d, i) => {
          const maxDia = Math.max(...m.por_dia, m.valor / 7);
          return `<div class="meta-dia ${i === 6 - m.dias_restantes ? 'hoje' : ''}" title="${d}: ${money(m.por_dia[i])}">
            <span class="meta-barra"><span style="height:${(m.por_dia[i] / maxDia) * 100}%"></span></span>
            <span class="small muted">${d}</span></div>`;
        }).join('')}
      </div>` : ''}
      <div class="meta-rodape small"><span class="muted">Toque para ver os gastos deste período</span>
        <a class="link" href="#/lancamentos?mes=${m.periodo_inicio.slice(0, 7)}&ver=metas">Períodos anteriores</a></div>
    </section>`;
}

/** Menu ⋯ da meta: editar, nova meta, excluir. */
function menuMeta(botao, meta, cats, ctx) {
  document.querySelectorAll('.menu-flutuante').forEach((m) => m.remove());
  const menu = document.createElement('div');
  menu.className = 'menu-flutuante';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = `
    <button type="button" role="menuitem" data-acao="editar">${icon('editar', 16)}Editar meta</button>
    <button type="button" role="menuitem" data-acao="nova">${icon('mais', 16, 2.4)}Nova meta</button>
    <button type="button" role="menuitem" data-acao="excluir" class="perigo">${icon('lixo', 16)}Excluir meta</button>`;
  document.body.appendChild(menu);
  const r = botao.getBoundingClientRect();
  menu.style.top = `${r.bottom + window.scrollY + 6}px`;
  menu.style.left = `${Math.max(12, r.right + window.scrollX - menu.offsetWidth)}px`;
  const fechar = () => { menu.remove(); document.removeEventListener('mousedown', fora, true); };
  const fora = (e) => { if (!menu.contains(e.target) && e.target !== botao) fechar(); };
  document.addEventListener('mousedown', fora, true);
  menu.querySelector('button').focus();
  menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
  menu.addEventListener('click', async (e) => {
    const acao = e.target.closest('[data-acao]')?.dataset.acao;
    if (!acao) return;
    fechar();
    if (acao === 'editar') abrirMeta(meta, cats, ctx.recarregar);
    if (acao === 'nova') abrirMeta(null, cats, ctx.recarregar);
    if (acao === 'excluir') {
      if (!await confirmar('Excluir meta', `Excluir a meta "${meta.nome}"? Seus lançamentos não mudam.`, [{ valor: true, rotulo: 'Excluir meta', perigo: true }])) return;
      try { await api.excluirMeta(meta.id); toast('Meta excluída'); ctx.recarregar(); } catch (ex) { toast(ex.message, 'erro'); }
    }
  });
}

export async function render(el, ctx) {
  const mes = mesDaTela(ctx.params);       // o mesmo mês nas abas Início, Lançamentos e Cartões
  const visao = visaoAtual(ctx.params);    // caixa (padrão) ou competência, para o site inteiro
  const competencia = visao === 'competencia';

  const [r, cats, cartoes, metas] = await Promise.all([
    api.resumo(mes, visao),
    api.categorias(),
    api.cartoes().catch(() => []),
    api.metas().catch(() => []),
  ]);
  if (!ctx.atual()) return;

  const cat = categoriaPorId(cats);
  const mapaCartoes = new Map(cartoes.map((c) => [c.id, c]));
  const primeiroNome = (sessao.usuario?.nome || '').split(' ')[0];
  const ehAtual = mes === r.mes_atual;
  const totalFaturas = cartoes.reduce((s, c) => s + c.fatura_atual, 0);
  // Primeiro acesso: conta sem nenhum lançamento ainda
  const contaVazia = !r.recentes.length && r.evolucao.every((e) => !e.receitas && !e.despesas);

  // Salário do mês (categoria Salário); sem ela, usa tudo o que entrou
  const usaSalario = r.evolucao.some((e) => e.salario > 0);
  const entrada = usaSalario ? r.salario : r.receitas;
  const nomeEntrada = usaSalario ? 'Salário' : 'Entradas';
  const resultado = entrada - r.despesas;
  const gastoPct = entrada > 0 ? (r.despesas / entrada) * 100 : 0;
  let situacao;
  if (!entrada && !r.despesas) situacao = 'Nada lançado neste mês ainda.';
  else if (resultado >= 0) situacao = `Sobrou ${money(resultado)} do ${nomeEntrada.toLowerCase()} este mês.`;
  else if (r.patrimonio >= -resultado) situacao = `Mês no vermelho em ${money(-resultado)}, coberto pelo que você tem guardado (ficaria ${money(r.patrimonio + resultado)}).`;
  else if (r.patrimonio > 0) situacao = `Mês no vermelho em ${money(-resultado)}: mais do que o guardado (${money(r.patrimonio)}).`;
  else situacao = `Mês no vermelho em ${money(-resultado)}.`;

  el.innerHTML = `
    <header class="page-head">
      <div>
        <p class="saudacao-data">${dataDeHoje()}</p>
        <h1 class="page-title">${saudacao()}${primeiroNome ? `, ${esc(primeiroNome)}` : ''}</h1>
        <p class="saudacao-sub">${proximaFatura(cartoes)}</p>
      </div>
      <div class="acoes-linha">
        <a href="#/importar" class="btn btn-ghost">${icon('importar', 18, 2.2)}Importar fatura</a>
        <a href="#/novo" class="btn btn-primary">${icon('mais', 18, 2.6)}Novo lançamento</a>
      </div>
    </header>

    ${contaVazia ? `
    <section class="card boas-vindas">
      <span class="cat-icon grande" style="background:#34D39922;color:#34D399">${icon('importar', 24, 2.2)}</span>
      <h2>Bem-vindo${primeiroNome ? `, ${esc(primeiroNome)}` : ''}! Vamos montar seu histórico</h2>
      <p class="muted">Importe as faturas do cartão (PDF, CSV ou OFX). O fin.app separa cada compra por categoria, cria as parcelas que ainda vão vir e você revisa antes de salvar.</p>
      <div class="acoes-linha">
        <a href="#/importar" class="btn btn-primary">${icon('importar', 18, 2.2)}Importar faturas</a>
        <a href="#/novo" class="btn btn-ghost">${icon('mais', 18, 2.6)}Lançar manualmente</a>
      </div>
    </section>` : ''}

    ${navMes({ mes, link: (m) => `#/inicio?mes=${m}` })}

    <div class="visao-linha">
      <div class="seg seg-visao" id="in-visao" role="radiogroup" aria-label="Como contar os gastos do cartão">
        <button type="button" role="radio" data-v="caixa" class="${competencia ? '' : 'on'}" aria-checked="${!competencia}">Caixa (vencimento)</button>
        <button type="button" role="radio" data-v="competencia" class="${competencia ? 'on' : ''}" aria-checked="${competencia}">Competência (compra)</button>
      </div>
      <span class="small muted">${competencia
        ? 'Compras no cartão contam no mês em que foram feitas.'
        : 'Compras no cartão contam no mês em que a fatura vence.'}</span>
    </div>

    <section class="grid-3">
      <article class="card hero span-2">
        <span class="muted small strong">${nomeEntrada} − gastos do mês</span>
        <div class="hero-val ${resultado < 0 ? 'neg' : ''}">${money(resultado)}</div>
        <div class="hero-pills">
          <span class="pill pos">${icon('sobe', 14, 2.4)} ${nomeEntrada} R$ ${brl(entrada)}</span>
          <span class="pill neg">${icon('desce', 14, 2.4)} Gastos R$ ${brl(r.despesas)}</span>
        </div>
        ${entrada > 0 ? `
        <div class="progress-wrap">
          <div class="bar thick"><span style="width:${Math.min(100, gastoPct)}%;background:${gastoPct > 100 ? 'var(--neg)' : gastoPct > 85 ? 'var(--warn)' : 'var(--accent)'}"></span></div>
          <div class="small muted">Gastou ${pct(gastoPct, 0)}% do ${nomeEntrada.toLowerCase()}</div>
        </div>` : ''}
        <p class="small ${resultado < 0 ? 'neg' : 'muted'} strong">${situacao}</p>
        ${!competencia && r.faturas_mes?.length ? `
        <div class="faturas-mes small">
          <span class="muted strong">Faturas que vencem no mês</span>
          ${r.faturas_mes.map((f) => `
            <a href="#/cartoes?id=${f.cartao_id}&mes=${mes}" class="faturas-mes-linha">
              <span class="trunca">${esc(f.nome)} <span class="muted">· vence ${f.vencimento.slice(8, 10)}/${f.vencimento.slice(5, 7)}</span></span>
              <span class="strong">${money(f.considerado)}</span>
              ${f.diferenca != null && Math.abs(f.diferenca) >= 0.01 ? `<span class="neg">calculado ${money(f.calculado)} (${money(f.diferenca)})</span>` : f.valor_oficial != null ? '<span class="pos">confere</span>' : '<span></span>'}
            </a>`).join('')}
        </div>` : ''}
      </article>

      <article class="card mini-cards">
        <a href="#/cartoes" class="mini">
          <span class="cat-icon" style="background:#60A5FA22;color:#60A5FA">${icon('cartao', 18)}</span>
          <span><span class="muted small">Faturas abertas</span><strong>${cartoes.length ? money(totalFaturas) : 'Nenhum cartão'}</strong></span>
        </a>
        <a href="#/investimentos" class="mini">
          <span class="cat-icon" style="background:#34D39922;color:#34D399">${icon('investimento', 18)}</span>
          <span><span class="muted small">Guardado (investimentos)</span><strong>${r.patrimonio ? money(r.patrimonio) : 'Cadastrar reserva'}</strong>
            ${r.meses_de_reserva ? `<span class="muted small">≈ ${pct(r.meses_de_reserva, 1)} meses dos seus gastos</span>` : ''}</span>
        </a>
      </article>
    </section>

    ${metas.length ? metas.map((m) => cardMeta(m)).join('') : `
    <section class="card meta-card">
      <div class="card-head"><h2 class="card-title">Metas</h2></div>
      <p class="muted small">Defina quanto quer gastar numa semana, quinzena ou mês com as categorias que escolher (ex.: R$ 600 por semana com comida) e acompanhe aqui quanto já foi.</p>
      <button class="btn btn-ghost" type="button" data-meta-nova>${icon('mais', 18, 2.4)}Definir meta</button>
    </section>`}

    <section class="grid-3">
      ${quadroCategorias({ id: 'in-categorias', itens: r.por_categoria, total: r.despesas, cat,
        dica: r.por_categoria.length ? 'Toque numa categoria para ver os lançamentos.' : '' })}

      <article class="card span-2">
        <h2 class="card-title">${nomeEntrada} x gastos por mês</h2>
        <div class="chart-box" style="height:220px"><canvas id="ch-bar" role="img" aria-label="Gastos por mês"></canvas></div>
      </article>
    </section>

    <section class="card lista-card">
      <div class="card-head">
        <h2 class="card-title">Últimos lançamentos</h2>
        <a href="#/lancamentos" class="small muted strong">Ver todos</a>
      </div>
      <div id="recentes">
        ${r.recentes.length ? r.recentes.map((t) => linhaLancamento(t, cat(t.categoria_id), { cartoes: mapaCartoes })).join('') : `
          <div class="empty">Nenhum lançamento ainda.<br><a href="#/novo" class="btn btn-primary" style="margin-top:12px">${icon('mais', 18, 2.6)}Adicionar o primeiro</a></div>`}
      </div>
    </section>`;

  ligarQuadro(el.querySelector('#in-categorias'), {
    itens: r.por_categoria, cat,
    aoEscolher: async (categoriaId) => {
      try {
        const d = await api.lancamentosDaCategoria(mes, visao, categoriaId);
        abrirCategoria({
          categoria: cat(categoriaId), periodo: `${nomeMes(mes)}${competencia ? ' (compra)' : ''}`,
          total: d.total, lancamentos: d.lancamentos, ajuste: d.ajuste_valor_oficial,
          cat, cats, cartoes, depois: ctx.recarregar,
        });
      } catch (e) { toast(e.message, 'erro'); }
    },
  });
  comparativoChart(el.querySelector('#ch-bar'), {
    labels: r.evolucao.map((e) => mesCurto(e.mes)),
    series: [
      { nome: nomeEntrada, valores: r.evolucao.map((e) => (usaSalario ? e.salario : e.receitas)), cor: '#6ee0a1' },
      { nome: 'Gastos', valores: r.evolucao.map((e) => e.despesas), cor: '#8c9d94' },
    ],
  });

  el.querySelector('[data-meta-nova]')?.addEventListener('click', () => abrirMeta(null, cats, ctx.recarregar));
  ligarNavMes(el, { mes, link: (m) => `#/inicio?mes=${m}`, ir: ctx.ir, visao });
  // Tocar na meta abre os gastos do período atual (o ⋯ e o link têm ação própria)
  const abrirMetaGastos = async (card) => {
    try {
      const g = await api.gastosDaMeta(card.dataset.metaAbrir);
      abrirGastosMeta({ g, cat, cats, cartoes, depois: ctx.recarregar });
    } catch (ex) { toast(ex.message, 'erro'); }
  };
  el.querySelectorAll('[data-meta-abrir]').forEach((card) => {
    card.addEventListener('click', (e) => { if (!e.target.closest('[data-meta-menu], a')) abrirMetaGastos(card); });
    card.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === card) { e.preventDefault(); abrirMetaGastos(card); } });
  });
  el.querySelectorAll('[data-meta-menu]').forEach((b) => b.addEventListener('click', () => {
    menuMeta(b, metas.find((m) => m.id === b.dataset.metaMenu), cats, ctx);
  }));

  el.querySelector('#in-visao').addEventListener('click', (e) => {
    const v = e.target.closest('[data-v]')?.dataset.v;
    if (!v || v === visao) return;
    salvarVisao(v);
    ctx.recarregar();
  });

  el.querySelector('#recentes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tx]');
    const t = b && r.recentes.find((x) => x.id === b.dataset.tx);
    if (t) abrirEdicao(t, cats, ctx.recarregar);
  });
}
