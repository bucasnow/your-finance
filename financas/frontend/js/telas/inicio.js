import { api, sessao } from '../api.js';
import { comparativoChart } from '../charts.js';
import { abrirCategoria, ligarQuadro, quadroCategorias } from './categorias-gasto.js';
import { icon } from '../icons.js';
import { abrirEdicao } from './lancamento-edicao.js';
import { abrirMeta } from './meta.js';
import { catIcon, categoriaPorId, linhaLancamento, toast } from '../ui.js';
import { brl, compact, esc, mesAtual, mesCurto, mesValido, money, nomeMes, pct, somarMeses } from '../utils.js';

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

// Caixa: compra no cartão conta no mês em que a fatura vence. Competência: no mês da compra.
const CHAVE_VISAO = 'fin.visao';
function visaoEscolhida(params) {
  const v = params.get('visao');
  if (v === 'caixa' || v === 'competencia') return v;
  try { return localStorage.getItem(CHAVE_VISAO) === 'competencia' ? 'competencia' : 'caixa'; } catch { return 'caixa'; }
}

export async function render(el, ctx) {
  const mes = mesValido(ctx.params.get('mes')) ? ctx.params.get('mes') : mesAtual();
  const visao = visaoEscolhida(ctx.params);
  const competencia = visao === 'competencia';
  const daVisao = competencia ? '&visao=competencia' : '';

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
  const meta = metas[0];

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

    <div class="month-nav">
      <a href="#/inicio?mes=${somarMeses(mes, -1)}${daVisao}" class="icon-btn" aria-label="Mês anterior">${icon('esquerda', 20, 2.2)}</a>
      <span class="strong">${nomeMes(mes)}</span>
      ${ehAtual ? '<span class="icon-btn" aria-hidden="true"></span>' : `<a href="#/inicio?mes=${somarMeses(mes, 1)}${daVisao}" class="icon-btn" aria-label="Próximo mês">${icon('direita', 20, 2.2)}</a>`}
    </div>

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

    ${meta ? `
    <section class="card meta-card">
      <div class="card-head">
        <h2 class="card-title">${esc(meta.nome)} da semana</h2>
        <button class="icon-btn" type="button" id="meta-editar" aria-label="Editar meta">${icon('editar', 18)}</button>
      </div>
      <div class="meta-topo">
        <div><span class="hero-val ${meta.restante < 0 ? 'neg' : ''}" style="font-size:30px">${money(meta.gasto)}</span>
          <span class="muted"> de ${money(meta.valor)}</span></div>
        <span class="badge ${meta.restante < 0 ? 'neg' : 'pos'}">${meta.restante < 0 ? `Passou ${money(-meta.restante)}` : `Pode gastar ${money(meta.restante)}`}</span>
      </div>
      <div class="bar thick"><span style="width:${Math.min(100, meta.percentual)}%;background:${meta.percentual > 100 ? 'var(--neg)' : meta.percentual > 80 ? 'var(--warn)' : 'var(--accent)'}"></span></div>
      <p class="small muted">${meta.dias_restantes > 0 && meta.restante > 0
        ? `Faltam ${meta.dias_restantes} dia${meta.dias_restantes > 1 ? 's' : ''} na semana · dá uns ${money(meta.restante / (meta.dias_restantes + 1))} por dia, contando hoje`
        : meta.dias_restantes > 0 ? `Faltam ${meta.dias_restantes} dia${meta.dias_restantes > 1 ? 's' : ''} na semana` : 'Último dia da semana'}</p>
      <div class="meta-dias">
        ${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d, i) => {
          const maxDia = Math.max(...meta.por_dia, meta.valor / 7);
          return `<div class="meta-dia ${i === 6 - meta.dias_restantes ? 'hoje' : ''}" title="${d}: ${money(meta.por_dia[i])}">
            <span class="meta-barra"><span style="height:${(meta.por_dia[i] / maxDia) * 100}%"></span></span>
            <span class="small muted">${d}</span></div>`;
        }).join('')}
      </div>
      <div class="meta-semanas small">
        ${meta.historico.slice(0, -1).map((s) => `<span class="${s.gasto > meta.valor ? 'neg' : 'muted'}">${s.inicio.slice(8, 10)}/${s.inicio.slice(5, 7)}: ${money(s.gasto)}</span>`).join('')}
      </div>
    </section>` : `
    <section class="card meta-card">
      <div class="card-head"><h2 class="card-title">Meta semanal de comida</h2></div>
      <p class="muted small">Defina quanto quer gastar por semana com comida (ex.: R$ 600) e acompanhe aqui quanto já foi.</p>
      <button class="btn btn-ghost" type="button" id="meta-editar">${icon('mais', 18, 2.4)}Definir meta</button>
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

  el.querySelector('#meta-editar').addEventListener('click', () => abrirMeta(meta || null, cats, ctx.recarregar));

  el.querySelector('#in-visao').addEventListener('click', (e) => {
    const v = e.target.closest('[data-v]')?.dataset.v;
    if (!v || v === visao) return;
    try { localStorage.setItem(CHAVE_VISAO, v); } catch { /* modo privado */ }
    ctx.ir(`#/inicio?mes=${mes}${v === 'competencia' ? '&visao=competencia' : '&visao=caixa'}`);
  });

  el.querySelector('#recentes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tx]');
    const t = b && r.recentes.find((x) => x.id === b.dataset.tx);
    if (t) abrirEdicao(t, cats, ctx.recarregar);
  });
}
