import { api } from '../api.js';
import { donutChart } from '../charts.js';
import { icon } from '../icons.js';
import { camposRendimento, faixaTaxas, ligarRendimento, PRAZOS, projetar, tabelaProjecao } from '../rendimento-ui.js';
import { confirmar, modal, ocupado, toast } from '../ui.js';
import { alpha, compact, dataLonga, esc, mascaraValor, money, parseBRL, pct } from '../utils.js';

const CORES_TIPO = {
  renda_fixa: '#34D399', tesouro: '#60A5FA', acoes: '#F472B6', fii: '#FBBF24',
  cripto: '#FB923C', poupanca: '#2DD4BF', previdencia: '#A78BFA', outros: '#94A3B8',
};
const SIGLAS = { renda_fixa: 'RF', tesouro: 'TD', acoes: 'AÇ', fii: 'FII', cripto: '₿', poupanca: 'PP', previdencia: 'PV', outros: '•' };

const sinal = (v) => (v > 0 ? '+' : v < 0 ? '−' : '');

/** Projeção do total: cada investimento na sua taxa; o aporte mensal na taxa média dos automáticos. */
function projecaoTotal(itens, aporte) {
  const auto = itens.filter((i) => i.automatico);
  const somaAuto = auto.reduce((s, i) => s + i.valor_atual, 0);
  const media = somaAuto ? auto.reduce((s, i) => s + i.taxa_anual * i.valor_atual, 0) / somaAuto
    : (auto[0]?.taxa_anual || 0);
  const hoje = itens.reduce((s, i) => s + i.valor_atual, 0);
  return PRAZOS.map(([m, rotulo]) => {
    const valor = itens.reduce((s, i) => s + projetar(i.valor_atual, i.automatico ? i.taxa_anual : 0, m), 0) + projetar(0, media, m, aporte);
    return { rotulo, valor, ganho: valor - hoje - aporte * m };
  });
}

export async function render(el, ctx) {
  const d = await api.investimentos();
  if (!ctx.atual()) return;

  const corRend = d.rendimento >= 0 ? 'pos' : 'neg';
  const temAuto = d.itens.some((i) => i.automatico);

  el.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">Investimentos</h1>
      <button class="btn btn-ghost" type="button" id="iv-novo">${icon('mais', 18, 2.4)}Adicionar</button>
    </header>
    ${faixaTaxas(d.taxas)}

    ${d.itens.length ? `
      <section class="grid-3">
        <article class="card hero span-2">
          <span class="muted small strong">Patrimônio investido hoje</span>
          <div class="hero-val">${money(d.total_atual)}</div>
          <div class="hero-pills">
            <span class="pill">Aplicado ${money(d.total_aplicado)}</span>
            <span class="pill ${corRend}">Rendeu ${sinal(d.rendimento)} ${money(Math.abs(d.rendimento))} (${sinal(d.rendimento_pct)}${pct(Math.abs(d.rendimento_pct), 2)}%)</span>
          </div>
          ${d.ir_estimado > 0 ? `<p class="muted small">Se resgatar tudo hoje: IR estimado de ${money(d.ir_estimado)} · líquido ${money(d.total_atual - d.ir_estimado)}</p>` : ''}
        </article>
        <article class="card">
          <h2 class="card-title">Por tipo</h2>
          <div class="donut-wrap" style="width:150px;height:150px">
            <canvas id="iv-donut" role="img" aria-label="Investimentos por tipo"></canvas>
            <div class="donut-center"><span class="muted small">Total</span><strong>${compact(d.total_atual)}</strong></div>
          </div>
          <div class="legend">
            ${d.por_tipo.map((t) => `<div class="legend-row"><span class="dot round" style="background:${CORES_TIPO[t.tipo]}"></span><span class="name">${esc(t.nome)}</span><span class="muted">${pct((t.valor / (d.total_atual || 1)) * 100, 0)}%</span></div>`).join('')}
          </div>
        </article>
      </section>

      ${temAuto ? `
      <section class="card">
        <div class="card-head"><h2 class="card-title">Projeção</h2>
          <label class="aporte-projecao small">Guardando <span class="amount mini"><span>R$</span><input id="iv-aporte" type="text" inputmode="numeric" placeholder="0,00"></span> por mês</label>
        </div>
        <div id="iv-projecao">${tabelaProjecao(projecaoTotal(d.itens, 0))}</div>
        <p class="muted small">Na taxa de hoje de cada investimento, antes do IR. Os de valor manual ficam parados na conta.</p>
      </section>` : ''}

      <section class="card lista-card" id="iv-lista">
        ${d.itens.map((i) => `
          <button type="button" class="tx-row" data-id="${i.id}">
            <span class="asset-badge" style="background:${alpha(CORES_TIPO[i.tipo], 0.16)};color:${CORES_TIPO[i.tipo]}">${SIGLAS[i.tipo]}</span>
            <span class="tx-main">
              <span class="tx-desc">${esc(i.nome)}</span>
              <span class="tx-meta">${i.automatico ? esc(i.taxa_descricao) : `${esc(i.tipo_nome)} · valor manual`}${i.instituicao ? ` · ${esc(i.instituicao)}` : ''}</span>
            </span>
            <span class="tx-val-col">
              <span class="tx-val">${money(i.valor_atual)}</span>
              <span class="small ${i.rendimento >= 0 ? 'pos' : 'neg'}">${sinal(i.rendimento)} ${money(Math.abs(i.rendimento))}</span>
            </span>
          </button>`).join('')}
      </section>
      <p class="muted small" style="text-align:center">Toque em um investimento para ver o rendimento, a projeção, aportar ou editar.</p>`
    : `
      <section class="card vazio-grande">
        <span class="cat-icon grande" style="background:#34D39922;color:#34D399">${icon('investimento', 30)}</span>
        <h2>Nenhum investimento ainda</h2>
        <p class="muted">Registre onde seu dinheiro está aplicado (ex.: CDB 100% do CDI). O fin.app calcula o rendimento todo dia com as taxas do Banco Central e mostra quanto vai ter no futuro.</p>
        <button class="btn btn-primary" type="button" id="iv-novo2">${icon('mais', 18, 2.6)}Adicionar investimento</button>
      </section>`}`;

  const abrirNovo = () => formulario(null, d, ctx);
  el.querySelector('#iv-novo').addEventListener('click', abrirNovo);
  el.querySelector('#iv-novo2')?.addEventListener('click', abrirNovo);
  el.querySelector('#iv-lista')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    const i = b && d.itens.find((x) => x.id === b.dataset.id);
    if (i) detalhes(i, d, ctx);
  });
  const aporte = el.querySelector('#iv-aporte');
  if (aporte) {
    mascaraValor(aporte);
    aporte.addEventListener('input', () => {
      el.querySelector('#iv-projecao').innerHTML = tabelaProjecao(projecaoTotal(d.itens, parseBRL(aporte.value)));
    });
  }

  if (d.por_tipo.length) {
    donutChart(el.querySelector('#iv-donut'), {
      labels: d.por_tipo.map((t) => t.nome),
      values: d.por_tipo.map((t) => t.valor),
      colors: d.por_tipo.map((t) => CORES_TIPO[t.tipo]),
    });
  }
}

/** Quanto rendeu, IR, projeção, aporte, editar e excluir. */
function detalhes(inv, d, ctx) {
  const linhas = (aporteMensal) => PRAZOS.map(([m, rotulo]) => {
    const valor = projetar(inv.valor_atual, inv.taxa_anual || 0, m, aporteMensal);
    return { rotulo, valor, ganho: valor - inv.valor_atual - aporteMensal * m };
  });
  const { el, fechar } = modal(inv.nome, `
    <div class="form-col">
      <div class="inv-resumo">
        <div><span class="muted small">Hoje</span><strong class="hero-val" style="font-size:28px">${money(inv.valor_atual)}</strong></div>
        <div><span class="muted small">Aplicado</span><strong>${money(inv.valor_aplicado)}</strong></div>
        <div><span class="muted small">Rendeu</span><strong class="${inv.rendimento >= 0 ? 'pos' : 'neg'}">${sinal(inv.rendimento)} ${money(Math.abs(inv.rendimento))}
          <span class="small">(${sinal(inv.rendimento_pct)}${pct(Math.abs(inv.rendimento_pct), 2)}%)</span></strong></div>
      </div>
      <p class="small">${inv.automatico ? `<strong>${esc(inv.taxa_descricao)}</strong> · calculado todo dia com as taxas do Banco Central` : 'Valor atualizado por você'}
        ${inv.data_aplicacao ? ` · aplicado em ${dataLonga(inv.data_aplicacao)}` : ''}</p>
      ${inv.automatico ? `
        <div class="aviso-leve small">${inv.isento_ir ? 'Isento de IR.' : `IR se resgatar hoje: ${pct(inv.ir_aliquota, 1)}% sobre o rendimento = ${money(inv.ir_estimado)} · você recebe ${money(inv.valor_liquido)}.`}</div>
        <div class="card-head"><span class="strong">Quanto vai ter</span>
          <label class="aporte-projecao small">+ <span class="amount mini"><span>R$</span><input id="dt-aporte" type="text" inputmode="numeric" placeholder="0,00"></span> por mês</label></div>
        <div id="dt-projecao">${tabelaProjecao(linhas(0))}</div>
        <p class="muted small">Na taxa de hoje, antes do IR.</p>` : ''}
      <div class="aporte-box">
        <span class="field-label">Adicionar dinheiro (aporte)</span>
        <div class="aporte-linha">
          <div class="amount pequeno"><span>R$</span><input id="dt-aporte-valor" type="text" inputmode="numeric" placeholder="0,00" autocomplete="off"></div>
          <button class="btn btn-primary" type="button" id="dt-aportar">${icon('mais', 16, 2.6)}Aportar</button>
        </div>
        <span class="muted small">${inv.automatico ? 'O que já está rendendo continua; o novo dinheiro rende a partir de hoje.' : 'Soma ao valor aplicado e ao valor atual.'}</span>
        <div class="form-error" id="dt-aporte-erro" role="alert"></div>
      </div>
      <div class="dois">
        <button class="btn btn-ghost" type="button" id="dt-editar">${icon('editar', 16)}Editar</button>
        <button class="btn btn-perigo-ghost" type="button" id="dt-excluir">${icon('lixo', 16)}Excluir</button>
      </div>
    </div>`);
  const ap = el.querySelector('#dt-aporte');
  if (ap) {
    mascaraValor(ap);
    ap.addEventListener('input', () => { el.querySelector('#dt-projecao').innerHTML = tabelaProjecao(linhas(parseBRL(ap.value))); });
  }
  const valorAporte = el.querySelector('#dt-aporte-valor');
  mascaraValor(valorAporte);
  el.querySelector('#dt-aportar').addEventListener('click', async (e) => {
    const valor = parseBRL(valorAporte.value);
    const erro = el.querySelector('#dt-aporte-erro');
    if (valor <= 0) { erro.textContent = 'Informe quanto vai adicionar.'; valorAporte.focus(); return; }
    const btn = e.currentTarget;
    ocupado(btn, true, 'Salvando…');
    try {
      await api.aportarInvestimento(inv.id, valor);
      fechar();
      toast(`${money(valor)} adicionados em ${inv.nome}`);
      ctx.recarregar();
    } catch (ex) { erro.textContent = ex.message; ocupado(btn, false); }
  });
  el.querySelector('#dt-editar').addEventListener('click', () => { fechar(); formulario(inv, d, ctx); });
  el.querySelector('#dt-excluir').addEventListener('click', async () => {
    fechar();
    const ok = await confirmar('Excluir investimento', `Excluir "${inv.nome}"?`, [{ valor: true, rotulo: 'Excluir', perigo: true }]);
    if (!ok) return;
    try { await api.excluirInvestimento(inv.id); toast('Investimento excluído'); ctx.recarregar(); } catch (ex) { toast(ex.message, 'erro'); }
  });
}

function formulario(inv, d, ctx) {
  const { el, fechar } = modal(inv ? 'Editar investimento' : 'Novo investimento', `
    <form novalidate class="form-col">
      <label class="field"><span class="field-label">Nome</span>
        <input class="input" id="if-nome" type="text" maxlength="60" placeholder="Ex.: CDB Banco X" value="${esc(inv?.nome || '')}"></label>
      <div class="dois">
        <label class="field"><span class="field-label">Tipo</span>
          <select class="input" id="if-tipo">${Object.entries(d.tipos).map(([k, n]) => `<option value="${k}" ${k === (inv?.tipo || 'renda_fixa') ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field"><span class="field-label">Instituição (opcional)</span>
          <input class="input" id="if-inst" type="text" maxlength="60" placeholder="Ex.: XP" value="${esc(inv?.instituicao || '')}"></label>
      </div>
      ${camposRendimento(d.indexadores, inv?.indexador || 'cdi', inv?.taxa, 'if')}
      <label class="field"><span class="field-label">Quanto você aplicou</span>
        <div class="amount pequeno"><span>R$</span><input id="if-aplicado" type="text" inputmode="numeric" placeholder="0,00"></div></label>
      <label class="field" id="if-data-campo"><span class="field-label">Data da aplicação</span>
        <input class="input" id="if-data" type="date" value="${inv?.data_aplicacao || new Date().toISOString().slice(0, 10)}">
        <span class="muted small" id="if-data-dica">O rendimento é calculado a partir dessa data.</span></label>
      <label class="field" id="if-atual-campo"><span class="field-label">Quanto vale hoje</span>
        <div class="amount pequeno"><span>R$</span><input id="if-atual" type="text" inputmode="numeric" placeholder="0,00"></div>
        <span class="muted small">Ações, fundos e cripto: atualize quando quiser.</span></label>
      ${inv?.atualizado_em && !inv.automatico ? `<p class="muted small">Valor atualizado em ${dataLonga(inv.atualizado_em)}</p>` : ''}
      <div class="form-error" role="alert"></div>
      <button class="btn btn-primary btn-block" type="submit">${icon('check', 18, 2.6)}Salvar</button>
    </form>`);

  const aplicado = el.querySelector('#if-aplicado');
  const atual = el.querySelector('#if-atual');
  mascaraValor(aplicado, inv?.valor_aplicado);
  mascaraValor(atual, inv?.valor_atual);
  let atualTocado = !!inv;
  atual.addEventListener('input', () => { atualTocado = true; });
  aplicado.addEventListener('input', () => { if (!atualTocado) atual.value = aplicado.value; });
  const lerRendimento = ligarRendimento(el, 'if', (indexador) => {
    el.querySelector('#if-atual-campo').hidden = indexador !== 'manual';
  });

  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const erro = el.querySelector('.form-error');
    const { indexador, taxa } = lerRendimento();
    const dados = {
      nome: el.querySelector('#if-nome').value.trim(),
      tipo: el.querySelector('#if-tipo').value,
      instituicao: el.querySelector('#if-inst').value.trim() || null,
      valor_aplicado: parseBRL(aplicado.value),
      valor_atual: indexador === 'manual' ? parseBRL(atual.value) : parseBRL(aplicado.value),
      data_aplicacao: el.querySelector('#if-data').value || null,
      indexador, taxa,
    };
    if (!dados.nome) { erro.textContent = 'Informe o nome do investimento.'; return; }
    if (dados.valor_aplicado <= 0) { erro.textContent = 'Informe quanto você aplicou.'; return; }
    if (taxa !== null && !(taxa >= 0)) { erro.textContent = 'Informe a taxa (ex.: 100 para 100% do CDI).'; return; }
    if (indexador !== 'manual' && !dados.data_aplicacao) { erro.textContent = 'Informe a data da aplicação.'; return; }
    const btn = e.submitter;
    ocupado(btn, true, 'Salvando…');
    try {
      if (inv) await api.editarInvestimento(inv.id, dados);
      else await api.criarInvestimento(dados);
      fechar();
      toast(inv ? 'Investimento atualizado' : 'Investimento adicionado');
      ctx.recarregar();
    } catch (ex) {
      erro.textContent = ex.message;
      ocupado(btn, false);
    }
  });
}
