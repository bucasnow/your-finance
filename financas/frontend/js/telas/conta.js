import { api, sessao } from '../api.js';
import { icon, ICONES_CATEGORIA } from '../icons.js';
import { catIcon, confirmar, modal, ocupado, toast } from '../ui.js';
import { esc } from '../utils.js';

const CORES_CATEGORIA = ['#F59E0B', '#84CC16', '#60A5FA', '#A78BFA', '#F87171', '#F472B6', '#38BDF8', '#FB923C', '#C084FC', '#34D399', '#2DD4BF', '#94A3B8'];

export async function render(el, ctx) {
  const [eu, cats] = await Promise.all([api.eu(), api.categorias()]);
  if (!ctx.atual()) return;
  sessao.atualizarUsuario(eu);
  const minhas = cats.filter((c) => c.propria);

  el.innerHTML = `
    <header class="page-head"><h1 class="page-title">Minha conta</h1></header>

    <section class="card perfil">
      <span class="avatar">${esc((eu.nome || '?').trim()[0]?.toUpperCase() || '?')}</span>
      <div class="trunca"><strong>${esc(eu.nome)}</strong><br><span class="muted small">${esc(eu.email)}</span></div>
    </section>

    <section class="card">
      <h2 class="card-title">Segurança</h2>
      <button type="button" class="linha-opcao" id="ct-senha">
        <span class="cat-icon" style="background:#60A5FA22;color:#60A5FA">${icon('cadeado', 18)}</span>
        <span class="tx-main"><span class="tx-desc">Alterar senha</span></span>
        ${icon('direita', 18)}
      </button>
      <button type="button" class="linha-opcao" id="ct-2fa">
        <span class="cat-icon" style="background:#34D39922;color:#34D399">${icon('escudo', 18)}</span>
        <span class="tx-main">
          <span class="tx-desc">Verificação em duas etapas</span>
          <span class="tx-meta">${eu.totp_ativo ? 'Ativada · pede um código do app autenticador ao entrar' : 'Desativada · opcional, deixa sua conta mais segura'}</span>
        </span>
        <span class="badge ${eu.totp_ativo ? 'pos' : ''}">${eu.totp_ativo ? 'Ativa' : 'Ativar'}</span>
      </button>
    </section>

    <section class="card">
      <div class="card-head">
        <h2 class="card-title">Minhas categorias</h2>
        <button type="button" class="btn btn-ghost" id="ct-nova-cat">${icon('mais', 16, 2.4)}Nova</button>
      </div>
      ${minhas.length ? minhas.map((c) => `
        <div class="linha-opcao">
          ${catIcon(c, 16)}
          <span class="tx-main"><span class="tx-desc">${esc(c.nome)}</span><span class="tx-meta">${c.tipo === 'receita' ? 'Receita' : 'Despesa'}</span></span>
          <button type="button" class="icon-btn" data-excluir-cat="${c.id}" aria-label="Excluir categoria ${esc(c.nome)}">${icon('lixo', 18)}</button>
        </div>`).join('') : '<p class="muted small">Além das categorias padrão, você pode criar as suas.</p>'}
    </section>

    <button type="button" class="btn btn-perigo-ghost btn-block" id="ct-sair">${icon('sair', 18)}Sair da conta</button>`;

  el.querySelector('#ct-senha').addEventListener('click', alterarSenha);
  el.querySelector('#ct-2fa').addEventListener('click', () => (eu.totp_ativo ? desativar2fa(ctx) : ativar2fa(ctx)));
  el.querySelector('#ct-nova-cat').addEventListener('click', () => novaCategoria(ctx));
  el.querySelectorAll('[data-excluir-cat]').forEach((b) => b.addEventListener('click', async () => {
    const c = minhas.find((x) => x.id === b.dataset.excluirCat);
    const ok = await confirmar('Excluir categoria', `Excluir "${c.nome}"? Os lançamentos dela ficam sem categoria.`, [{ valor: true, rotulo: 'Excluir', perigo: true }]);
    if (!ok) return;
    try { await api.excluirCategoria(c.id); toast('Categoria excluída'); ctx.recarregar(); } catch (e) { toast(e.message, 'erro'); }
  }));
  el.querySelector('#ct-sair').addEventListener('click', () => {
    sessao.encerrar();
    document.dispatchEvent(new CustomEvent('fin:sair', { detail: 'Você saiu da conta.' }));
  });
}

function formSimples(titulo, campos, botao, acao) {
  const { el, fechar } = modal(titulo, `
    <form novalidate class="form-col">
      ${campos}
      <div class="form-error" role="alert"></div>
      <button class="btn btn-primary btn-block" type="submit">${botao}</button>
    </form>`);
  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const erro = el.querySelector('.form-error');
    erro.textContent = '';
    const btn = e.submitter;
    ocupado(btn, true);
    try {
      await acao(el);
      fechar();
    } catch (ex) {
      erro.textContent = ex.message;
      ocupado(btn, false);
    }
  });
  return el;
}

const campoSenha = (id, rotulo, auto = 'new-password') => `
  <label class="field"><span class="field-label">${rotulo}</span><input class="input" id="${id}" type="password" autocomplete="${auto}"></label>`;

function alterarSenha() {
  formSimples('Alterar senha',
    campoSenha('as-atual', 'Senha atual', 'current-password') + campoSenha('as-nova', 'Nova senha (mínimo 8 caracteres)') + campoSenha('as-nova2', 'Confirme a nova senha'),
    'Salvar nova senha',
    async (el) => {
      const nova = el.querySelector('#as-nova').value;
      if (nova.length < 8) throw new Error('A nova senha precisa ter pelo menos 8 caracteres.');
      if (nova !== el.querySelector('#as-nova2').value) throw new Error('As senhas não são iguais.');
      await api.alterarSenha(el.querySelector('#as-atual').value, nova);
      toast('Senha alterada');
    });
}

async function ativar2fa(ctx) {
  let dados;
  try { dados = await api.iniciar2fa(); } catch (e) { toast(e.message, 'erro'); return; }
  const el = formSimples('Ativar verificação em duas etapas', `
    <ol class="passos muted">
      <li>Instale um app autenticador (Google Authenticator, Microsoft Authenticator ou Authy).</li>
      <li>No app, escaneie o QR code abaixo.</li>
      <li>Digite o código de 6 dígitos que aparecer.</li>
    </ol>
    <img class="qr" src="${dados.qr}" alt="QR code para o app autenticador" width="200" height="200">
    <p class="muted small" style="text-align:center">Não consegue escanear? Digite esta chave no app:<br><code class="chave">${esc(dados.secret)}</code></p>
    <input class="input codigo" id="a2-codigo" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" aria-label="Código de 6 dígitos">`,
  'Ativar',
  async (form) => {
    const codigo = form.querySelector('#a2-codigo').value.replace(/\D/g, '');
    if (codigo.length !== 6) throw new Error('O código tem 6 dígitos.');
    await api.ativar2fa(codigo);
    toast('Verificação em duas etapas ativada');
    ctx.recarregar();
  });
  const input = el.querySelector('#a2-codigo');
  input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 6); });
}

function desativar2fa(ctx) {
  formSimples('Desativar verificação em duas etapas',
    '<p class="muted">Para desativar, confirme sua senha.</p>' + campoSenha('d2-senha', 'Senha', 'current-password'),
    'Desativar',
    async (el) => {
      await api.desativar2fa(el.querySelector('#d2-senha').value);
      toast('Verificação em duas etapas desativada');
      ctx.recarregar();
    });
}

function novaCategoria(ctx) {
  let icone = 'outros';
  let cor = CORES_CATEGORIA[0];
  const el = formSimples('Nova categoria', `
    <label class="field"><span class="field-label">Nome</span><input class="input" id="nc-nome" type="text" maxlength="40" placeholder="Ex.: Academia"></label>
    <div class="seg" id="nc-tipo"><button type="button" class="on" data-v="despesa">Despesa</button><button type="button" data-v="receita">Receita</button></div>
    <div class="field"><span class="field-label">Ícone</span><div class="icones" id="nc-icone">
      ${ICONES_CATEGORIA.map((i) => `<button type="button" class="icone-op ${i === icone ? 'on' : ''}" data-v="${i}" aria-label="${i}">${icon(i, 18)}</button>`).join('')}</div></div>
    <div class="field"><span class="field-label">Cor</span><div class="cores" id="nc-cor">
      ${CORES_CATEGORIA.map((c) => `<button type="button" class="cor ${c === cor ? 'on' : ''}" data-v="${c}" style="background:${c}" aria-label="Cor ${c}"></button>`).join('')}</div></div>`,
  'Criar categoria',
  async (form) => {
    const nome = form.querySelector('#nc-nome').value.trim();
    if (!nome) throw new Error('Informe o nome da categoria.');
    const tipo = form.querySelector('#nc-tipo .on').dataset.v;
    await api.criarCategoria({ nome, tipo, icone, cor });
    toast('Categoria criada');
    ctx.recarregar();
  });

  const escolher = (sel, aplicar) => el.querySelector(sel).addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    el.querySelectorAll(`${sel} [data-v]`).forEach((x) => x.classList.toggle('on', x === b));
    aplicar(b.dataset.v);
  });
  escolher('#nc-tipo', () => {});
  escolher('#nc-icone', (v) => { icone = v; });
  escolher('#nc-cor', (v) => { cor = v; });
}
