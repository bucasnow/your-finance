import { api } from '../api.js';
import { icon } from '../icons.js';
import { abrirEdicao } from './lancamento-edicao.js';
import { categoriaPorId, confirmar, linhaLancamento, modal, ocupado, toast } from '../ui.js';
import { ddmm, esc, mascaraValor, mesValido, money, nomeMes, parseBRL, somarMeses } from '../utils.js';

const CORES = { padrao: 'Grafite', roxo: 'Roxo', laranja: 'Laranja', azul: 'Azul', verde: 'Verde', vermelho: 'Vermelho', preto: 'Preto', dourado: 'Dourado' };
const STATUS = { aberta: 'Aberta', fechada: 'Fechada', futura: 'Futura' };

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
  const cartoes = await api.cartoes();
  if (!ctx.atual()) return;

  if (!cartoes.length) {
    el.innerHTML = `
      <header class="page-head"><h1 class="page-title">Cartões</h1></header>
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

  const cat = categoriaPorId(cats);
  const usoPct = sel.limite ? Math.min(100, (sel.limite_usado / sel.limite) * 100) : 0;
  const link = (mes) => `#/cartoes?id=${sel.id}&mes=${mes}`;

  el.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">Cartões</h1>
      <button class="btn btn-ghost" type="button" id="ct-novo">${icon('mais', 18, 2.4)}Adicionar</button>
    </header>

    <div class="cards-layout">
      <div class="cartoes-lista">
        ${cartoes.map((c) => `<a href="#/cartoes?id=${c.id}" class="cartao-item ${c.id === sel.id ? 'on' : ''}" aria-label="${esc(c.nome)}">${plastico(c)}</a>`).join('')}
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
              <span class="badge status-${fatura.status}">${STATUS[fatura.status]}</span>
              <div class="hero-val" style="font-size:32px;margin-top:8px">${money(fatura.total)}</div>
            </div>
            <a href="#/novo" class="btn btn-ghost">${icon('mais', 16, 2.4)}Compra</a>
          </div>
          <div class="info-grid small">
            <div><span class="muted">Fecha em</span><br><strong>${ddmm(fatura.fechamento)}</strong></div>
            <div><span class="muted">Vence em</span><br><strong>${ddmm(fatura.vencimento)}</strong></div>
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
  el.querySelector('#ct-compras').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tx]');
    const t = b && fatura.lancamentos.find((x) => x.id === b.dataset.tx);
    if (t) abrirEdicao(t, cats, ctx.recarregar);
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
