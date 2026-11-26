// Objetivos (viagem, carro, reserva…): quanto juntar até quando, com rendimento próprio (como as
// "caixinhas" dos bancos). A barra sobe com cada depósito e com o rendimento.
import { api } from '../api.js';
import { icon } from '../icons.js';
import { camposRendimento, faixaTaxas, ligarRendimento } from '../rendimento-ui.js';
import { confirmar, modal, ocupado, toast } from '../ui.js';
import { esc, mascaraValor, money, parseBRL, pct } from '../utils.js';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesAno = (iso) => `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`;
const ddmmaa = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
const hojeISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function situacao(o) {
  if (o.alcancado) return '<span class="badge pos">Objetivo alcançado 🎉</span>';
  if (o.atrasado) return '<span class="badge neg">Prazo chegou</span>';
  if (!o.guardado) return '<span class="badge">Comece guardando</span>';
  return o.no_ritmo ? '<span class="badge pos">No ritmo</span>' : '<span class="badge neg">Abaixo do ritmo</span>';
}

function cartao(o) {
  const quando = o.chega_em && !o.alcancado ? `No ritmo atual, chega lá em ${mesAno(o.chega_em)}.` : '';
  return `
    <article class="card objetivo ${o.alcancado ? 'alcancado' : ''}" data-objetivo="${o.id}">
      <div class="card-head">
        <div><h2 class="card-title">${esc(o.nome)}</h2>
          <span class="muted small">Até ${mesAno(o.data_alvo)} · ${esc(o.taxa_descricao)}</span></div>
        <button class="icon-btn" type="button" data-acao="menu" aria-label="Opções de ${esc(o.nome)}"><span class="tres-pontos" aria-hidden="true">⋯</span></button>
      </div>
      <div class="objetivo-valores">
        <span class="hero-val" style="font-size:30px">${money(o.total)}</span>
        <span class="muted"> de ${money(o.valor_alvo)}</span>
        ${situacao(o)}
      </div>
      <div class="objetivo-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${o.percentual}">
        <span class="objetivo-guardado" data-largura="${Math.min(100, (o.guardado / o.valor_alvo) * 100)}"></span>
        <span class="objetivo-rendeu" data-largura="${o.percentual}"></span>
        <span class="objetivo-pct">${pct(o.percentual, 0)}%</span>
      </div>
      <div class="objetivo-legenda small">
        <span><i class="ponto-cor guardado"></i>Guardado ${money(o.guardado)}</span>
        <span><i class="ponto-cor rendeu"></i>Rendeu ${o.rendimento >= 0 ? '+' : '−'} ${money(Math.abs(o.rendimento))}</span>
        ${o.falta > 0 ? `<span class="muted">Falta ${money(o.falta)}</span>` : ''}
      </div>
      ${o.alcancado ? '' : `
      <div class="objetivo-plano">
        <span class="small muted">${o.meses_restantes ? `Para chegar em ${mesAno(o.data_alvo)}, guarde` : 'Para completar agora, faltam'}</span>
        <strong>${money(o.guardar_por_mes)}${o.meses_restantes ? ' por mês' : ''}</strong>
        ${o.meses_restantes && o.indexador !== 'nenhum' && o.guardar_por_mes_sem_rendimento > o.guardar_por_mes
          ? `<span class="small muted">Sem rendimento seriam ${money(o.guardar_por_mes_sem_rendimento)} — o rendimento economiza ${money((o.guardar_por_mes_sem_rendimento - o.guardar_por_mes) * o.meses_restantes)}.</span>` : ''}
        ${quando ? `<span class="small muted">${quando}</span>` : ''}
      </div>`}
      ${o.ir_estimado > 0 ? `<p class="small muted">Se resgatar hoje: IR estimado de ${money(o.ir_estimado)} · líquido ${money(o.total_liquido)}.</p>` : ''}
      <div class="dois">
        <button class="btn btn-primary" type="button" data-acao="guardei">${icon('mais', 16, 2.6)}Guardei</button>
        <button class="btn btn-ghost" type="button" data-acao="retirei">Retirei</button>
      </div>
    </article>`;
}

export async function render(el, ctx) {
  const d = await api.objetivos();
  if (!ctx.atual()) return;
  el.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">Objetivos</h1>
      <button class="btn btn-ghost" type="button" id="ob-novo">${icon('mais', 18, 2.4)}Novo objetivo</button>
    </header>
    ${faixaTaxas(d.taxas)}
    ${d.itens.length ? `
      <section class="card summary-row">
        <div class="info"><span class="muted small">Guardado</span><strong>${money(d.total_guardado)}</strong></div>
        <div class="info"><span class="muted small">Rendeu</span><strong class="pos">+ ${money(d.total_rendimento)}</strong></div>
        <div class="info"><span class="muted small">Total</span><strong>${money(d.total)}</strong></div>
      </section>
      <section class="objetivos-grade">${d.itens.map(cartao).join('')}</section>` : `
      <section class="card vazio-grande">
        <span class="cat-icon grande" style="background:#6ee0a122;color:#6ee0a1">${icon('estrela', 30)}</span>
        <h2>Junte dinheiro para o que você quer</h2>
        <p class="muted">Viagem, carro, reserva… Diga quanto precisa e para quando: o fin.app calcula quanto guardar por mês, contando o rendimento (ex.: 100% do CDI), e mostra a barra subindo até chegar lá.</p>
        <button class="btn btn-primary" type="button" id="ob-novo2">${icon('mais', 18, 2.6)}Criar objetivo</button>
      </section>`}`;

  // A barra cresce até o valor (animação ao abrir a tela)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.querySelectorAll('[data-largura]').forEach((b) => { b.style.width = `${b.dataset.largura}%`; });
  }));

  const novo = () => formulario(null, d, ctx);
  el.querySelector('#ob-novo').addEventListener('click', novo);
  el.querySelector('#ob-novo2')?.addEventListener('click', novo);
  el.querySelector('.objetivos-grade')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-acao]');
    const card = e.target.closest('[data-objetivo]');
    if (!b || !card) return;
    const o = d.itens.find((x) => x.id === card.dataset.objetivo);
    if (b.dataset.acao === 'guardei') movimento(o, 1, ctx);
    if (b.dataset.acao === 'retirei') movimento(o, -1, ctx);
    if (b.dataset.acao === 'menu') menu(o, d, ctx);
  });
}

function movimento(o, sinal, ctx) {
  const { el, fechar } = modal(sinal > 0 ? `Guardei · ${o.nome}` : `Retirei · ${o.nome}`, `
    <form novalidate class="form-col">
      <label class="field"><span class="field-label">${sinal > 0 ? 'Quanto você guardou' : 'Quanto você retirou'}</span>
        <div class="amount"><span>R$</span><input id="mv-valor" type="text" inputmode="numeric" placeholder="0,00" autocomplete="off"></div></label>
      ${sinal > 0 && o.guardar_por_mes > 0 ? `<button type="button" class="chip" id="mv-sugestao">Sugestão do mês: ${money(o.guardar_por_mes)}</button>` : ''}
      <label class="field"><span class="field-label">Quando</span>
        <input class="input" id="mv-data" type="date" value="${hojeISO()}" max="${hojeISO()}"></label>
      <p class="muted small">${sinal > 0 ? 'Rende a partir dessa data.' : `Disponível hoje: ${money(o.total)}.`}</p>
      <div class="form-error" role="alert"></div>
      <button class="btn btn-primary btn-block" type="submit">${icon('check', 18, 2.6)}Salvar</button>
    </form>`);
  const valor = el.querySelector('#mv-valor');
  mascaraValor(valor);
  valor.focus();
  el.querySelector('#mv-sugestao')?.addEventListener('click', () => { mascaraValor(valor, o.guardar_por_mes); });
  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = parseBRL(valor.value);
    const erro = el.querySelector('.form-error');
    if (v <= 0) { erro.textContent = 'Informe o valor.'; return; }
    const btn = e.submitter;
    ocupado(btn, true, 'Salvando…');
    try {
      const r = await api.movimentarObjetivo(o.id, sinal * v, el.querySelector('#mv-data').value || null);
      fechar();
      toast(r.alcancado && !o.alcancado ? `🎉 ${o.nome}: objetivo alcançado!` : sinal > 0 ? `${money(v)} guardados` : `${money(v)} retirados`);
      ctx.recarregar();
    } catch (ex) { erro.textContent = ex.message; ocupado(btn, false); }
  });
}

function menu(o, d, ctx) {
  const { el, fechar } = modal(o.nome, `
    <div class="form-col">
      <span class="field-label">Histórico</span>
      <div class="lista-card mov-lista">
        ${o.movimentos.length ? o.movimentos.map((m) => `
          <div class="mov-linha">
            <span>${ddmmaa(m.data)}</span>
            <strong class="${m.valor > 0 ? 'pos' : 'neg'}">${m.valor > 0 ? '+' : '−'} ${money(Math.abs(m.valor))}</strong>
            <button type="button" class="icon-btn" data-desfazer="${m.id}" aria-label="Desfazer">${icon('lixo', 16)}</button>
          </div>`).join('') : '<div class="empty">Nada guardado ainda.</div>'}
      </div>
      <div class="dois">
        <button class="btn btn-ghost" type="button" id="om-editar">${icon('editar', 16)}Editar</button>
        <button class="btn btn-perigo-ghost" type="button" id="om-excluir">${icon('lixo', 16)}Excluir</button>
      </div>
    </div>`);
  el.querySelector('.mov-lista').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-desfazer]');
    if (!b) return;
    fechar();
    if (!await confirmar('Desfazer', 'Apagar este registro do histórico?', [{ valor: true, rotulo: 'Apagar', perigo: true }])) return;
    try { await api.desfazerMovimentoObjetivo(o.id, b.dataset.desfazer); toast('Registro apagado'); ctx.recarregar(); } catch (ex) { toast(ex.message, 'erro'); }
  });
  el.querySelector('#om-editar').addEventListener('click', () => { fechar(); formulario(o, d, ctx); });
  el.querySelector('#om-excluir').addEventListener('click', async () => {
    fechar();
    if (!await confirmar('Excluir objetivo', `Excluir "${o.nome}" e o histórico dele?`, [{ valor: true, rotulo: 'Excluir', perigo: true }])) return;
    try { await api.excluirObjetivo(o.id); toast('Objetivo excluído'); ctx.recarregar(); } catch (ex) { toast(ex.message, 'erro'); }
  });
}

function formulario(o, d, ctx) {
  const daqui12 = new Date(); daqui12.setMonth(daqui12.getMonth() + 12);
  const { el, fechar } = modal(o ? 'Editar objetivo' : 'Novo objetivo', `
    <form novalidate class="form-col">
      <label class="field"><span class="field-label">Qual o objetivo</span>
        <input class="input" id="of-nome" type="text" maxlength="60" placeholder="Ex.: Viagem para São Paulo" value="${esc(o?.nome || '')}"></label>
      <div class="dois">
        <label class="field"><span class="field-label">Quanto vai precisar</span>
          <div class="amount pequeno"><span>R$</span><input id="of-valor" type="text" inputmode="numeric" placeholder="12.000,00"></div></label>
        <label class="field"><span class="field-label">Para quando</span>
          <input class="input" id="of-data" type="month" value="${(o?.data_alvo || daqui12.toISOString()).slice(0, 7)}"></label>
      </div>
      ${camposRendimento(d.indexadores, o?.indexador || 'cdi', o?.taxa ?? 100, 'of')}
      <p class="muted small">Onde o dinheiro vai ficar guardado. Ex.: caixinha ou CDB a 100% do CDI. Se for ficar parado, escolha "Sem rendimento".</p>
      <div class="form-error" role="alert"></div>
      <button class="btn btn-primary btn-block" type="submit">${icon('check', 18, 2.6)}${o ? 'Salvar' : 'Criar objetivo'}</button>
    </form>`);
  const valor = el.querySelector('#of-valor');
  mascaraValor(valor, o?.valor_alvo);
  const ler = ligarRendimento(el, 'of');
  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const erro = el.querySelector('.form-error');
    const mes = el.querySelector('#of-data').value;
    const { indexador, taxa } = ler();
    const dados = { nome: el.querySelector('#of-nome').value.trim(), valor_alvo: parseBRL(valor.value),
      data_alvo: mes ? `${mes}-01` : null, indexador, taxa };
    if (!dados.nome) { erro.textContent = 'Dê um nome ao objetivo.'; return; }
    if (dados.valor_alvo <= 0) { erro.textContent = 'Informe quanto vai precisar.'; return; }
    if (!dados.data_alvo) { erro.textContent = 'Informe para quando.'; return; }
    const btn = e.submitter;
    ocupado(btn, true, 'Salvando…');
    try {
      if (o) await api.editarObjetivo(o.id, dados); else await api.criarObjetivo(dados);
      fechar();
      toast(o ? 'Objetivo atualizado' : 'Objetivo criado');
      ctx.recarregar();
    } catch (ex) { erro.textContent = ex.message; ocupado(btn, false); }
  });
}
