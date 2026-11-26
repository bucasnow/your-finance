// Navegação de mês das abas Início, Lançamentos e Cartões: setas, seletor (ano + 12 meses) e "Hoje".
import { api } from './api.js';
import { icon } from './icons.js';
import { salvarVisao } from './estado.js';
import { esc, mesAtual, nomeMes, somarMeses } from './utils.js';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** HTML da barra. `link(mes)` monta o endereço de um mês; `rotulo` troca o texto do meio. */
export function navMes({ mes, link, rotulo, rotuloAnterior = 'Mês anterior', rotuloProximo = 'Próximo mês' }) {
  const atual = mesAtual();
  return `
    <div class="month-nav nav-mes">
      <a href="${link(somarMeses(mes, -1))}" class="icon-btn" aria-label="${rotuloAnterior}">${icon('esquerda', 20, 2.2)}</a>
      <div class="nav-mes-centro">
        <button type="button" class="mes-botao" data-mes-picker aria-haspopup="dialog" aria-label="Escolher mês">
          <span class="strong">${esc(rotulo || nomeMes(mes))}</span>${icon('direita', 14, 2.4)}</button>
        ${mes !== atual ? `<a href="${link(atual)}" class="chip mes-hoje">Hoje</a>` : ''}
      </div>
      <a href="${link(somarMeses(mes, 1))}" class="icon-btn" aria-label="${rotuloProximo}">${icon('direita', 20, 2.2)}</a>
    </div>`;
}

/** Liga o seletor: ao tocar no mês, abre o ano com os 12 meses; os que têm lançamentos ganham um ponto. */
export function ligarNavMes(raiz, { mes, link, ir, visao = 'caixa' }) {
  const botao = raiz?.querySelector('[data-mes-picker]');
  if (!botao) return;
  botao.addEventListener('click', async () => {
    if (document.querySelector('.seletor-mes')) { fecharSeletor(); return; }
    let ano = Number(mes.slice(0, 4));
    let comDados = new Set();
    const caixa = document.createElement('div');
    caixa.className = 'seletor-mes';
    caixa.setAttribute('role', 'dialog');
    caixa.setAttribute('aria-label', 'Escolher mês');
    document.body.appendChild(caixa);
    const posicionar = () => {
      const r = botao.getBoundingClientRect();
      const largura = Math.min(300, window.innerWidth - 24);
      caixa.style.width = `${largura}px`;
      caixa.style.top = `${r.bottom + window.scrollY + 8}px`;
      caixa.style.left = `${Math.max(12, Math.min(window.innerWidth - largura - 12, r.left + r.width / 2 - largura / 2)) + window.scrollX}px`;
    };
    const desenhar = () => {
      caixa.innerHTML = `
        <div class="seletor-ano">
          <button type="button" class="icon-btn" data-ano="-1" aria-label="Ano anterior">${icon('esquerda', 18, 2.2)}</button>
          <strong>${ano}</strong>
          <button type="button" class="icon-btn" data-ano="1" aria-label="Próximo ano">${icon('direita', 18, 2.2)}</button>
        </div>
        <div class="seletor-grade">
          ${MESES.map((n, i) => {
            const m = `${ano}-${String(i + 1).padStart(2, '0')}`;
            return `<button type="button" data-mes="${m}" class="${m === mes ? 'on' : ''} ${m === mesAtual() ? 'hoje' : ''}" aria-pressed="${m === mes}">
              ${n}${comDados.has(m) ? '<span class="ponto" aria-label="tem lançamentos"></span>' : ''}</button>`;
          }).join('')}
        </div>
        <button type="button" class="btn btn-ghost btn-compacto seletor-hoje" data-mes="${mesAtual()}">Ir para o mês atual</button>`;
    };
    desenhar();
    posicionar();
    caixa.querySelector('.on, [data-mes]')?.focus();
    caixa.addEventListener('click', (e) => {
      const a = e.target.closest('[data-ano]');
      if (a) { ano += Number(a.dataset.ano); desenhar(); return; }
      const m = e.target.closest('[data-mes]');
      if (m) { fecharSeletor(); ir(link(m.dataset.mes)); }
    });
    caixa.addEventListener('keydown', (e) => { if (e.key === 'Escape') { fecharSeletor(); botao.focus(); } });
    setTimeout(() => document.addEventListener('mousedown', fora, true));
    window.addEventListener('hashchange', fecharSeletor, { once: true });
    function fora(e) { if (!caixa.contains(e.target) && !botao.contains(e.target)) fecharSeletor(); }
    function fecharSeletor() { caixa.remove(); document.removeEventListener('mousedown', fora, true); }
    try {
      const r = await api.mesesComLancamentos();
      comDados = new Set(r[visao] || []);
      if (caixa.isConnected) desenhar();
    } catch { /* sem os pontos, o seletor funciona igual */ }
  });
}

function fecharSeletor() {
  document.querySelectorAll('.seletor-mes').forEach((s) => s.remove());
}

/** Alternador Caixa | Competência: vale para o site inteiro. */
export function seletorVisao(visao) {
  return `
    <div class="seg seg-visao" data-visao-seg role="radiogroup" aria-label="Como contar os gastos do cartão">
      <button type="button" role="radio" data-v="caixa" class="${visao === 'caixa' ? 'on' : ''}" aria-checked="${visao === 'caixa'}">Caixa (vencimento)</button>
      <button type="button" role="radio" data-v="competencia" class="${visao === 'competencia' ? 'on' : ''}" aria-checked="${visao === 'competencia'}">Competência (compra)</button>
    </div>`;
}

export function ligarVisao(raiz, depois) {
  raiz.querySelector('[data-visao-seg]')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b || b.classList.contains('on')) return;
    salvarVisao(b.dataset.v);
    depois();
  });
}
