import { api } from '../api.js';
import { donutChart } from '../charts.js';
import { icon } from '../icons.js';
import { confirmar, modal, ocupado, toast } from '../ui.js';
import { alpha, compact, dataLonga, esc, mascaraValor, money, parseBRL, pct } from '../utils.js';

const CORES_TIPO = {
  renda_fixa: '#34D399', tesouro: '#60A5FA', acoes: '#F472B6', fii: '#FBBF24',
  cripto: '#FB923C', poupanca: '#2DD4BF', previdencia: '#A78BFA', outros: '#94A3B8',
};
const SIGLAS = { renda_fixa: 'RF', tesouro: 'TD', acoes: 'AÇ', fii: 'FII', cripto: '₿', poupanca: 'PP', previdencia: 'PV', outros: '•' };

const sinal = (v) => (v > 0 ? '+' : v < 0 ? '−' : '');

export async function render(el, ctx) {
  const d = await api.investimentos();
  if (!ctx.atual()) return;

  const corRend = d.rendimento >= 0 ? 'pos' : 'neg';

  el.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">Investimentos</h1>
      <button class="btn btn-ghost" type="button" id="iv-novo">${icon('mais', 18, 2.4)}Adicionar</button>
    </header>

    ${d.itens.length ? `
      <section class="grid-3">
        <article class="card hero span-2">
          <span class="muted small strong">Patrimônio investido</span>
          <div class="hero-val">${money(d.total_atual)}</div>
          <div class="hero-pills">
            <span class="pill">Aplicado ${money(d.total_aplicado)}</span>
            <span class="pill ${corRend}">${sinal(d.rendimento)} ${money(Math.abs(d.rendimento))} (${sinal(d.rendimento_pct)}${pct(Math.abs(d.rendimento_pct), 2)}%)</span>
          </div>
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

      <section class="card lista-card" id="iv-lista">
        ${d.itens.map((i) => `
          <button type="button" class="tx-row" data-id="${i.id}">
            <span class="asset-badge" style="background:${alpha(CORES_TIPO[i.tipo], 0.16)};color:${CORES_TIPO[i.tipo]}">${SIGLAS[i.tipo]}</span>
            <span class="tx-main">
              <span class="tx-desc">${esc(i.nome)}</span>
              <span class="tx-meta">${esc(i.tipo_nome)}${i.instituicao ? ` · ${esc(i.instituicao)}` : ''} · aplicado ${money(i.valor_aplicado)}</span>
            </span>
            <span class="tx-val-col">
              <span class="tx-val">${money(i.valor_atual)}</span>
              <span class="small ${i.rendimento >= 0 ? 'pos' : 'neg'}">${sinal(i.rendimento_pct)}${pct(Math.abs(i.rendimento_pct), 2)}%</span>
            </span>
          </button>`).join('')}
      </section>
      <p class="muted small" style="text-align:center">Toque em um investimento para atualizar o valor atual.</p>`
    : `
      <section class="card vazio-grande">
        <span class="cat-icon grande" style="background:#34D39922;color:#34D399">${icon('investimento', 30)}</span>
        <h2>Nenhum investimento ainda</h2>
        <p class="muted">Registre onde seu dinheiro está aplicado e acompanhe quanto rendeu.</p>
        <button class="btn btn-primary" type="button" id="iv-novo2">${icon('mais', 18, 2.6)}Adicionar investimento</button>
      </section>`}`;

  const abrirNovo = () => formulario(null, d.tipos, ctx);
  el.querySelector('#iv-novo').addEventListener('click', abrirNovo);
  el.querySelector('#iv-novo2')?.addEventListener('click', abrirNovo);
  el.querySelector('#iv-lista')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    const i = b && d.itens.find((x) => x.id === b.dataset.id);
    if (i) formulario(i, d.tipos, ctx);
  });

  if (d.por_tipo.length) {
    donutChart(el.querySelector('#iv-donut'), {
      labels: d.por_tipo.map((t) => t.nome),
      values: d.por_tipo.map((t) => t.valor),
      colors: d.por_tipo.map((t) => CORES_TIPO[t.tipo]),
    });
  }
}

function formulario(inv, tipos, ctx) {
  const { el, fechar } = modal(inv ? 'Editar investimento' : 'Novo investimento', `
    <form novalidate class="form-col">
      <label class="field"><span class="field-label">Nome</span>
        <input class="input" id="if-nome" type="text" maxlength="60" placeholder="Ex.: CDB Banco X 110% CDI" value="${esc(inv?.nome || '')}"></label>
      <div class="dois">
        <label class="field"><span class="field-label">Tipo</span>
          <select class="input" id="if-tipo">${Object.entries(tipos).map(([k, n]) => `<option value="${k}" ${k === (inv?.tipo || 'renda_fixa') ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field"><span class="field-label">Instituição (opcional)</span>
          <input class="input" id="if-inst" type="text" maxlength="60" placeholder="Ex.: XP" value="${esc(inv?.instituicao || '')}"></label>
      </div>
      <label class="field"><span class="field-label">Quanto você aplicou</span>
        <div class="amount pequeno"><span>R$</span><input id="if-aplicado" type="text" inputmode="numeric" placeholder="0,00"></div></label>
      <label class="field"><span class="field-label">Quanto vale hoje</span>
        <div class="amount pequeno"><span>R$</span><input id="if-atual" type="text" inputmode="numeric" placeholder="0,00"></div>
        <span class="muted small">Se acabou de aplicar, é o mesmo valor aplicado.</span></label>
      <label class="field"><span class="field-label">Data da aplicação (opcional)</span>
        <input class="input" id="if-data" type="date" value="${inv?.data_aplicacao || ''}"></label>
      ${inv?.atualizado_em ? `<p class="muted small">Valor atualizado em ${dataLonga(inv.atualizado_em)}</p>` : ''}
      <div class="form-error" role="alert"></div>
      <button class="btn btn-primary btn-block" type="submit">${icon('check', 18, 2.6)}Salvar</button>
      ${inv ? `<button class="btn btn-perigo-ghost btn-block" type="button" id="if-excluir">${icon('lixo', 18)}Excluir</button>` : ''}
    </form>`);

  const aplicado = el.querySelector('#if-aplicado');
  const atual = el.querySelector('#if-atual');
  mascaraValor(aplicado, inv?.valor_aplicado);
  mascaraValor(atual, inv?.valor_atual);
  let atualTocado = !!inv;
  atual.addEventListener('input', () => { atualTocado = true; });
  aplicado.addEventListener('input', () => { if (!atualTocado) atual.value = aplicado.value; });

  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const erro = el.querySelector('.form-error');
    const dados = {
      nome: el.querySelector('#if-nome').value.trim(),
      tipo: el.querySelector('#if-tipo').value,
      instituicao: el.querySelector('#if-inst').value.trim() || null,
      valor_aplicado: parseBRL(aplicado.value),
      valor_atual: parseBRL(atual.value),
      data_aplicacao: el.querySelector('#if-data').value || null,
    };
    if (!dados.nome) { erro.textContent = 'Informe o nome do investimento.'; return; }
    if (dados.valor_aplicado <= 0) { erro.textContent = 'Informe quanto você aplicou.'; return; }
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

  el.querySelector('#if-excluir')?.addEventListener('click', async () => {
    fechar();
    const ok = await confirmar('Excluir investimento', `Excluir "${inv.nome}"?`, [{ valor: true, rotulo: 'Excluir', perigo: true }]);
    if (!ok) return;
    try {
      await api.excluirInvestimento(inv.id);
      toast('Investimento excluído');
      ctx.recarregar();
    } catch (ex) { toast(ex.message, 'erro'); }
  });
}
