import { api } from '../api.js';
import { icon } from '../icons.js';
import { abrirEdicao } from './lancamento-edicao.js';
import { categoriaPorId, confirmar, linhaLancamento, modal, ocupado, toast } from '../ui.js';
import { ddmm, esc, mascaraValor, mesCurto, mesValido, money, nomeMes, parseBRL, somarMeses } from '../utils.js';

/** Quadro com todas as compras parceladas que ainda têm parcelas a pagar. */
function quadroParcelas(p, cartoes, cat) {
  if (!p?.compras.length) return '';
  const nomeCartao = new Map(cartoes.map((c) => [c.id, c.nome]));
  return `
    <section class="card parcelas-card">
      <div class="card-head">
        <h2 class="card-title">Parcelas em aberto</h2>
        <span class="muted small">${p.compras.length} compra${p.compras.length > 1 ? 's' : ''}</span>
      </div>
      <div class="info-grid">
        <div><span class="muted small">Total em parcelas</span><br><strong class="neg" style="font-size:22px">${money(p.total_restante)}</strong></div>
        <div><span class="muted small">Parcelas deste mês</span><br><strong style="font-size:22px">${money(p.total_este_mes)}</strong></div>
      </div>
      <div class="parc-meses">
        ${p.por_mes.slice(0, 12).map((m) => `<span class="chip"><span class="muted">${mesCurto(m.mes)}</span> ${money(m.valor)}</span>`).join('')}
      </div>
      <div class="parc-tabela" role="table" aria-label="Parcelas em aberto">
        <div class="parc-linha parc-cab small muted" role="row">
          <span role="columnheader">Compra</span><span role="columnheader">Parcela</span>
          <span role="columnheader">Valor</span><span role="columnheader">Falta pagar</span>
        </div>
        ${p.compras.map((c) => `
        <div class="parc-linha" role="row">
          <span class="parc-compra" role="cell">
            <span class="tx-desc">${esc(c.descricao)}</span>
            <span class="tx-meta">${esc(nomeCartao.get(c.cartao_id) || 'Sem cartão')} · ${esc(cat(c.categoria_id).nome)} · até ${mesCurto(c.ultima_parcela.slice(0, 7))}</span>
          </span>
          <span role="cell" class="strong">${c.parcela_atual}/${c.total_parcelas}</span>
          <span role="cell">${money(c.valor_parcela)}</span>
          <span role="cell" class="strong">${money(c.valor_restante)}<span class="muted small" style="display:block">${c.parcelas_restantes}x</span></span>
        </div>`).join('')}
      </div>
    </section>`;
}

const CORES = { padrao: 'Grafite', roxo: 'Roxo', laranja: 'Laranja', azul: 'Azul', verde: 'Verde', vermelho: 'Vermelho', preto: 'Preto', dourado: 'Dourado' };
const STATUS = { aberta: 'Aberta', fechada: 'Fechada', paga: 'Paga', previa: 'Prévia', futura: 'Prévia' };

function plastico(c, grande = false) {
  return `
    <div class="plastic ${grande ? 'big' : ''} cor-${esc(c.cor)}">
      <div class="p-top">
        <span class="p-name">${esc(c.nome)}</span>
        <span style="opacity:.7">${icon('contactless', grande ? 26 : 22)}</span>
      </div>
      ${grande ? '<div class="chipset"></div>' : `<div><span class="p-value">${money(c.fatura_atual)}</span><span class="small" style="opacity:.75;display:block">fatura atual</span></div>`}
      <div class="p-foot">
        <span class="p-num">•••• ${esc(c.final || '····')}</span>
        <span class="small" style="opacity:.85">Vence ${ddmm(c.vencimento)}</span>
      </div>
    </div>`;
}

export async function render(el, ctx) {
  const [cartoes, parcelas, todasCats] = await Promise.all([api.cartoes(), api.parcelas().catch(() => null), api.categorias()]);
  if (!ctx.atual()) return;
  const quadro = quadroParcelas(parcelas, cartoes, categoriaPorId(todasCats));

  if (!cartoes.length) {
    el.innerHTML = `
      <header class="page-head"><h1 class="page-title">Cartões</h1></header>
      ${quadro}
      <section class="card vazio-grande">
        <span class="cat-icon grande" style="background:#60A5FA22;color:#60A5FA">${icon('cartao', 30)}</span>
        <h2>Nenhum cartão ainda</h2>
        <p class="muted">Cadastre seus cartões de crédito para acompanhar faturas, limite e compras parceladas.</p>
        <button class="btn btn-primary" type="button" id="ct-novo">${icon('mais', 18, 2.6)}Adicionar cartão</button>
      </section>`;
    el.querySelector('#ct-novo').addEventListener('click', () => formularioCartao(null, ctx));
    return;
  }

  const sel = cartoes.find((c) => c.id === ctx.params.get('id')) || cartoes[0];
  const mesFatura = mesValido(ctx.params.get('mes')) ? ctx.params.get('mes') : sel.fatura_mes;
  const [fatura, cats] = await Promise.all([api.fatura(sel.id, mesFatura), api.categorias()]);
  if (!ctx.atual()) return;
  // Faturas de todos os cartões que vencem no mesmo mês, para o total
  const faturasMes = await Promise.all(cartoes.map((c) => (c.id === sel.id ? fatura : api.fatura(c.id, fatura.mes).catch(() => null))));
  if (!ctx.atual()) return;
  // Valor oficial salvo prevalece sobre o calculado (a regra fica no servidor)
  const considerado = (f) => (f ? f.total_considerado ?? f.total : 0);
  const totalMes = faturasMes.reduce((s, f) => s + considerado(f), 0);

  const cat = categoriaPorId(cats);
  const usoPct = sel.limite ? Math.min(100, (sel.limite_usado / sel.limite) * 100) : 0;
  const link = (mes) => `#/cartoes?id=${sel.id}&mes=${mes}`;

  el.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">Cartões</h1>
      <button class="btn btn-ghost" type="button" id="ct-novo">${icon('mais', 18, 2.4)}Adicionar</button>
    </header>

    ${quadro}

    <div class="cards-layout">
      <div class="cartoes-col">
        <section class="card total-cartoes">
          <span class="muted small strong">Total dos cartões · ${nomeMes(fatura.mes)}</span>
          <strong class="total-cartoes-val">${money(totalMes)}</strong>
          ${cartoes.map((c, i) => `
            <div class="total-cartoes-linha small"><span class="dot round cor-${esc(c.cor)}"></span><span class="trunca">${esc(c.nome)}</span>
              <span class="${c.id === sel.id ? 'strong' : 'muted'}">${money(considerado(faturasMes[i]))}</span></div>`).join('')}
        </section>
        <div class="cartoes-lista">
          ${cartoes.map((c) => `<a href="#/cartoes?id=${c.id}&mes=${fatura.mes}" class="cartao-item ${c.id === sel.id ? 'on' : ''}" aria-label="${esc(c.nome)}">${plastico(c)}</a>`).join('')}
        </div>
      </div>

      <div class="form-col">
        <section class="card">
          <div class="card-head">
            <h2 class="strong" style="font-size:18px">${esc(sel.nome)}</h2>
            <div style="display:flex;gap:4px">
              <button class="icon-btn" type="button" id="ct-editar" aria-label="Editar cartão">${icon('editar', 18)}</button>
              <button class="icon-btn" type="button" id="ct-excluir" aria-label="Excluir cartão">${icon('lixo', 18)}</button>
            </div>
          </div>
          ${sel.limite ? `
            <div class="progress-wrap">
              <div class="bar thick"><span style="width:${usoPct}%;background:${usoPct > 90 ? 'var(--neg)' : 'var(--accent)'}"></span></div>
              <div class="small" style="display:flex;justify-content:space-between;gap:8px">
                <span class="muted">Usado ${money(sel.limite_usado)}</span>
                <span class="strong">Disponível ${money(sel.limite_disponivel)}</span>
              </div>
            </div>` : '<p class="muted small">Sem limite informado.</p>'}
          <p class="muted small">Fecha todo dia ${sel.dia_fechamento} · vence todo dia ${sel.dia_vencimento}</p>
        </section>

        <div class="month-nav">
          <a href="${link(somarMeses(fatura.mes, -1))}" class="icon-btn" aria-label="Fatura anterior">${icon('esquerda', 20, 2.2)}</a>
          <span class="strong">Fatura de ${nomeMes(fatura.mes)}</span>
          <a href="${link(somarMeses(fatura.mes, 1))}" class="icon-btn" aria-label="Próxima fatura">${icon('direita', 20, 2.2)}</a>
        </div>

        <section class="card">
          <div class="card-head">
            <div>
              <span class="badge status-${fatura.status}">${STATUS[fatura.status] || fatura.status}</span>
              <div class="hero-val" style="font-size:32px;margin-top:8px">${money(considerado(fatura))}</div>
            </div>
            <div class="acoes-linha">
              <button class="btn btn-ghost btn-compacto" type="button" id="ct-ajustar">${icon('editar', 16, 2.2)}Ajustar fatura</button>
              <a href="#/novo" class="btn btn-ghost btn-compacto">${icon('mais', 16, 2.4)}Compra</a>
            </div>
          </div>
          ${fatura.valor_oficial != null ? `
          <div class="conferencia small">
            <span><span class="muted">Calculado</span> <strong>${money(fatura.total)}</strong></span>
            <span><span class="muted">Oficial</span> <strong>${money(fatura.valor_oficial)}</strong></span>
            <span class="${Math.abs(fatura.diferenca) >= 0.01 ? 'neg' : 'pos'}"><span class="muted">Diferença</span> <strong>${Math.abs(fatura.diferenca) >= 0.01 ? money(fatura.diferenca) : 'bate'}</strong></span>
          </div>` : ''}
          <div class="info-grid small">
            <div><span class="muted">Compras de</span><br><strong>${ddmm(fatura.inicio)} a ${ddmm(fatura.fechamento)}</strong></div>
            <div><span class="muted">Vence em</span><br><strong>${ddmm(fatura.vencimento)}</strong>${fatura.datas_ajustadas ? ' <span class="muted">(ajustado)</span>' : ''}</div>
          </div>
        </section>

        <section class="card lista-card" id="ct-compras">
          ${fatura.lancamentos.length
            ? fatura.lancamentos.map((t) => linhaLancamento(t, cat(t.categoria_id))).join('')
            : '<div class="empty">Nenhuma compra nesta fatura.</div>'}
        </section>
      </div>
    </div>`;

  el.querySelector('#ct-novo').addEventListener('click', () => formularioCartao(null, ctx));
  el.querySelector('#ct-editar').addEventListener('click', () => formularioCartao(sel, ctx));
  el.querySelector('#ct-excluir').addEventListener('click', async () => {
    const ok = await confirmar('Excluir cartão', `Excluir "${sel.nome}"? Todas as compras lançadas nele também serão apagadas.`, [{ valor: true, rotulo: 'Excluir cartão e compras', perigo: true }]);
    if (!ok) return;
    try {
      await api.excluirCartao(sel.id);
      toast('Cartão excluído');
      ctx.ir('#/cartoes');
    } catch (e) { toast(e.message, 'erro'); }
  });
  el.querySelector('#ct-ajustar').addEventListener('click', () => ajustarFatura(sel, fatura, ctx));
  el.querySelector('#ct-compras').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tx]');
    const t = b && fatura.lancamentos.find((x) => x.id === b.dataset.tx);
    if (t) abrirEdicao(t, cats, ctx.recarregar);
  });
}

/** Dados reais da fatura: fechamento/vencimento fora do padrão, valor oficial e se já foi paga. */
function ajustarFatura(cartao, f, ctx) {
  const { el, fechar } = modal(`Ajustar fatura de ${nomeMes(f.mes)}`, `
    <form novalidate class="form-col">
      <p class="muted small">Use quando o banco fechar ou vencer fora do dia de sempre, e para conferir o total com o da fatura.</p>
      <div class="dois">
        <label class="field"><span class="field-label">Fechou em</span>
          <input class="input" id="af-fech" type="date" value="${f.datas_ajustadas ? f.fechamento : ''}"></label>
        <label class="field"><span class="field-label">Vence em</span>
          <input class="input" id="af-venc" type="date" value="${f.datas_ajustadas ? f.vencimento : ''}"></label>
      </div>
      <p class="muted small">Atual: fecha ${ddmm(f.fechamento)}, vence ${ddmm(f.vencimento)}. Deixe em branco para usar o dia padrão do cartão.</p>
      <label class="field"><span class="field-label">Valor oficial da fatura (opcional)</span>
        <div class="amount pequeno"><span>R$</span><input id="af-oficial" type="text" inputmode="numeric" placeholder="0,00" autocomplete="off"></div>
        <span class="muted small">Calculado pelos lançamentos: ${money(f.total)}</span></label>
      <label class="switch-linha"><span class="strong">Fatura paga</span><input type="checkbox" class="switch" id="af-paga" role="switch" ${f.paga ? 'checked' : ''}></label>
      <div class="form-error" role="alert"></div>
      <button class="btn btn-primary btn-block" type="submit">${icon('check', 18, 2.6)}Salvar</button>
      ${f.valor_oficial != null || f.datas_ajustadas || f.paga ? '<button class="btn btn-ghost btn-block" type="button" id="af-limpar">Voltar ao padrão</button>' : ''}
    </form>`);
  const oficial = el.querySelector('#af-oficial');
  mascaraValor(oficial, f.valor_oficial || 0);
  const erro = el.querySelector('.form-error');

  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = {
      data_fechamento: el.querySelector('#af-fech').value || null,
      data_vencimento: el.querySelector('#af-venc').value || null,
      valor_oficial: oficial.value ? parseBRL(oficial.value) : null,
      paga: el.querySelector('#af-paga').checked,
    };
    const btn = e.submitter;
    ocupado(btn, true, 'Salvando…');
    try {
      await api.ajustarFatura(cartao.id, f.mes, dados);
      fechar();
      toast('Fatura ajustada');
      ctx.recarregar();
    } catch (ex) {
      erro.textContent = ex.message;
      ocupado(btn, false);
    }
  });
  el.querySelector('#af-limpar')?.addEventListener('click', async () => {
    try {
      await api.removerAjusteFatura(cartao.id, f.mes);
      fechar();
      toast('Fatura voltou ao padrão');
      ctx.recarregar();
    } catch (ex) { erro.textContent = ex.message; }
  });
}

function formularioCartao(c, ctx) {
  const dia = (id, rotulo, v) => `
    <label class="field"><span class="field-label">${rotulo}</span>
      <select class="input" id="${id}">${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${i + 1 === v ? 'selected' : ''}>Dia ${i + 1}</option>`).join('')}</select></label>`;
  const cor = c?.cor || 'padrao';

  const { el, fechar } = modal(c ? 'Editar cartão' : 'Novo cartão', `
    <form novalidate class="form-col">
      <label class="field"><span class="field-label">Nome do cartão</span>
        <input class="input" id="cf-nome" type="text" maxlength="40" placeholder="Ex.: Nubank" value="${esc(c?.nome || '')}"></label>
      <div class="dois">
        <label class="field"><span class="field-label">Final (opcional)</span>
          <input class="input" id="cf-final" type="text" inputmode="numeric" maxlength="4" placeholder="1234" value="${esc(c?.final || '')}"></label>
        <label class="field"><span class="field-label">Limite</span>
          <div class="amount pequeno"><span>R$</span><input id="cf-limite" type="text" inputmode="numeric" placeholder="0,00"></div></label>
      </div>
      <div class="dois">
        ${dia('cf-fech', 'Fechamento', c?.dia_fechamento || 1)}
        ${dia('cf-venc', 'Vencimento', c?.dia_vencimento || 10)}
      </div>
      <div class="field"><span class="field-label">Cor</span>
        <div class="cores" id="cf-cor">${Object.entries(CORES).map(([k, nome]) => `<button type="button" class="cor cor-${k} ${k === cor ? 'on' : ''}" data-v="${k}" aria-label="${nome}" title="${nome}"></button>`).join('')}</div></div>
      <div class="form-error" role="alert"></div>
      <button class="btn btn-primary btn-block" type="submit">${icon('check', 18, 2.6)}Salvar cartão</button>
    </form>`);

  let corEscolhida = cor;
  const limite = el.querySelector('#cf-limite');
  mascaraValor(limite, c?.limite || 0);
  const final = el.querySelector('#cf-final');
  final.addEventListener('input', () => { final.value = final.value.replace(/\D/g, '').slice(0, 4); });
  el.querySelector('#cf-cor').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    corEscolhida = b.dataset.v;
    el.querySelectorAll('#cf-cor .cor').forEach((x) => x.classList.toggle('on', x === b));
  });

  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const erro = el.querySelector('.form-error');
    const dados = {
      nome: el.querySelector('#cf-nome').value.trim(),
      final: final.value || null,
      limite: parseBRL(limite.value),
      dia_fechamento: Number(el.querySelector('#cf-fech').value),
      dia_vencimento: Number(el.querySelector('#cf-venc').value),
      cor: corEscolhida,
    };
    if (!dados.nome) { erro.textContent = 'Informe o nome do cartão.'; return; }
    if (dados.final && dados.final.length !== 4) { erro.textContent = 'O final do cartão tem 4 dígitos.'; return; }
    const btn = e.submitter;
    ocupado(btn, true, 'Salvando…');
    try {
      const salvo = c ? await api.editarCartao(c.id, dados) : await api.criarCartao(dados);
      fechar();
      toast(c ? 'Cartão atualizado' : 'Cartão adicionado');
      ctx.ir(`#/cartoes?id=${salvo.id}`);
    } catch (ex) {
      erro.textContent = ex.message;
      ocupado(btn, false);
    }
  });
}
