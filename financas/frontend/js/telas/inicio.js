import { api, sessao } from '../api.js';
import { barChart, donutChart } from '../charts.js';
import { icon } from '../icons.js';
import { abrirEdicao } from './lancamento-edicao.js';
import { catIcon, categoriaPorId, linhaLancamento } from '../ui.js';
import { brl, compact, esc, mesAtual, mesCurto, mesValido, money, nomeMes, pct, somarMeses } from '../utils.js';

export async function render(el, ctx) {
  const mes = mesValido(ctx.params.get('mes')) ? ctx.params.get('mes') : mesAtual();

  const [r, cats, cartoes, invest] = await Promise.all([
    api.resumo(mes),
    api.categorias(),
    api.cartoes().catch(() => []),
    api.investimentos().catch(() => null),
  ]);
  if (!ctx.atual()) return;

  const cat = categoriaPorId(cats);
  const mapaCartoes = new Map(cartoes.map((c) => [c.id, c]));
  const primeiroNome = (sessao.usuario?.nome || '').split(' ')[0];
  const ehAtual = mes === r.mes_atual;
  const cats5 = r.por_categoria.slice(0, 5);
  const totalFaturas = cartoes.reduce((s, c) => s + c.fatura_atual, 0);
  // Primeiro acesso: conta sem nenhum lançamento ainda
  const contaVazia = !r.recentes.length && r.evolucao.every((e) => !e.receitas && !e.despesas);

  el.innerHTML = `
    <header class="page-head">
      <div>
        <p class="muted small strong">${primeiroNome ? `Olá, ${esc(primeiroNome)}` : 'Olá'}</p>
        <h1 class="page-title">Início</h1>
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
      <a href="#/inicio?mes=${somarMeses(mes, -1)}" class="icon-btn" aria-label="Mês anterior">${icon('esquerda', 20, 2.2)}</a>
      <span class="strong">${nomeMes(mes)}</span>
      ${ehAtual ? '<span class="icon-btn" aria-hidden="true"></span>' : `<a href="#/inicio?mes=${somarMeses(mes, 1)}" class="icon-btn" aria-label="Próximo mês">${icon('direita', 20, 2.2)}</a>`}
    </div>

    <section class="grid-3">
      <article class="card hero span-2">
        <span class="muted small strong">Saldo do mês</span>
        <div class="hero-val ${r.saldo < 0 ? 'neg' : ''}">${money(r.saldo)}</div>
        <div class="hero-pills">
          <span class="pill pos">${icon('sobe', 14, 2.4)} Entrou R$ ${brl(r.receitas)}</span>
          <span class="pill neg">${icon('desce', 14, 2.4)} Saiu R$ ${brl(r.despesas)}</span>
        </div>
      </article>

      <article class="card mini-cards">
        <a href="#/cartoes" class="mini">
          <span class="cat-icon" style="background:#60A5FA22;color:#60A5FA">${icon('cartao', 18)}</span>
          <span><span class="muted small">Faturas abertas</span><strong>${cartoes.length ? money(totalFaturas) : 'Nenhum cartão'}</strong></span>
        </a>
        <a href="#/investimentos" class="mini">
          <span class="cat-icon" style="background:#34D39922;color:#34D399">${icon('investimento', 18)}</span>
          <span><span class="muted small">Investido</span><strong>${invest?.itens.length ? money(invest.total_atual) : 'Nada ainda'}</strong></span>
        </a>
      </article>
    </section>

    <section class="grid-3">
      <article class="card">
        <h2 class="card-title">Gastos por categoria</h2>
        ${cats5.length ? `
          <div class="donut-wrap" style="width:160px;height:160px">
            <canvas id="ch-cat" role="img" aria-label="Gastos por categoria"></canvas>
            <div class="donut-center"><span class="muted small">Total</span><strong>${compact(r.despesas)}</strong></div>
          </div>
          <div class="legend">
            ${cats5.map((c) => { const k = cat(c.categoria_id); return `<div class="legend-row">${catIcon(k, 14)}<span class="name">${esc(k.nome)}</span><span class="muted">${pct((c.total / (r.despesas || 1)) * 100, 0)}%</span><span class="val">${compact(c.total)}</span></div>`; }).join('')}
          </div>` : '<div class="empty">Nenhum gasto neste mês.</div>'}
      </article>

      <article class="card span-2">
        <h2 class="card-title">Gastos nos últimos meses</h2>
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

  if (cats5.length) {
    donutChart(el.querySelector('#ch-cat'), {
      labels: cats5.map((c) => cat(c.categoria_id).nome),
      values: cats5.map((c) => c.total),
      colors: cats5.map((c) => cat(c.categoria_id).cor),
    });
  }
  barChart(el.querySelector('#ch-bar'), {
    labels: r.evolucao.map((e) => mesCurto(e.mes)),
    values: r.evolucao.map((e) => e.despesas),
    highlight: r.evolucao.length - 1,
  });

  el.querySelector('#recentes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tx]');
    const t = b && r.recentes.find((x) => x.id === b.dataset.tx);
    if (t) abrirEdicao(t, cats, ctx.recarregar);
  });
}
