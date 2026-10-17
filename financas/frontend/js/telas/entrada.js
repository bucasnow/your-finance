import { api, sessao } from '../api.js';
import { icon } from '../icons.js';
import { ocupado } from '../ui.js';

const CHAVE_2FA = 'fin.token2fa';

function cartao(titulo, subtitulo, corpo) {
  return `
    <div class="auth-card">
      <div class="auth-logo">${icon('logo', 30, 2.6)}<span>fin.app</span></div>
      <div>
        <h1 class="auth-title">${titulo}</h1>
        ${subtitulo ? `<p class="muted small" style="text-align:center;margin-top:6px">${subtitulo}</p>` : ''}
      </div>
      ${corpo}
    </div>`;
}

const campo = (id, rotulo, tipo, extra = '') => `
  <label class="field"><span class="field-label">${rotulo}</span>
    <input class="input" id="${id}" type="${tipo}" ${extra}></label>`;

/** Liga um formulário: valida, mostra erro, desabilita botão, chama a ação. */
function ligar(el, acao) {
  const form = el.querySelector('form');
  const erro = el.querySelector('.form-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erro.textContent = '';
    erro.classList.remove('ok');
    const btn = form.querySelector('button[type=submit]');
    ocupado(btn, true);
    try {
      await acao(form, erro);
    } catch (ex) {
      erro.textContent = ex.message;
    } finally {
      if (btn.isConnected) ocupado(btn, false);
    }
  });
}

function entrou(resposta) {
  sessao.iniciar(resposta);
  sessionStorage.removeItem(CHAVE_2FA);
  document.dispatchEvent(new CustomEvent('fin:entrou'));
}

const TELAS = {
  '#/entrar'(el, { ir }) {
    el.innerHTML = cartao('Entrar', '', `
      <form novalidate class="form-col">
        ${campo('e-email', 'E-mail', 'email', 'autocomplete="email" inputmode="email" placeholder="seu@email.com" required')}
        ${campo('e-senha', 'Senha', 'password', 'autocomplete="current-password" placeholder="Sua senha" required')}
        <div class="form-error" role="alert"></div>
        <button class="btn btn-primary btn-block" type="submit">Entrar</button>
      </form>
      <div class="auth-links">
        <a href="#/esqueci">Esqueci minha senha</a>
        <span>Não tem conta? <a href="#/cadastro" class="strong">Criar conta</a></span>
      </div>`);
    ligar(el, async (f) => {
      const email = f.querySelector('#e-email').value.trim();
      const senha = f.querySelector('#e-senha').value;
      if (!email || !senha) throw new Error('Preencha e-mail e senha.');
      const r = await api.entrar(email, senha);
      if (r.requer_2fa) {
        sessionStorage.setItem(CHAVE_2FA, r.token_2fa);
        return ir('#/2fa');
      }
      entrou(r);
    });
  },

  '#/cadastro'(el) {
    el.innerHTML = cartao('Criar conta', 'Seus dados ficam visíveis só para você.', `
      <form novalidate class="form-col">
        ${campo('c-nome', 'Nome', 'text', 'autocomplete="name" placeholder="Como quer ser chamado" maxlength="80" required')}
        ${campo('c-email', 'E-mail', 'email', 'autocomplete="email" inputmode="email" placeholder="seu@email.com" required')}
        ${campo('c-senha', 'Senha', 'password', 'autocomplete="new-password" placeholder="Mínimo 8 caracteres" minlength="8" required')}
        ${campo('c-senha2', 'Confirme a senha', 'password', 'autocomplete="new-password" placeholder="Repita a senha" required')}
        <div class="form-error" role="alert"></div>
        <button class="btn btn-primary btn-block" type="submit">Criar conta</button>
      </form>
      <div class="auth-links"><span>Já tem conta? <a href="#/entrar" class="strong">Entrar</a></span></div>`);
    ligar(el, async (f) => {
      const nome = f.querySelector('#c-nome').value.trim();
      const email = f.querySelector('#c-email').value.trim();
      const senha = f.querySelector('#c-senha').value;
      if (!nome) throw new Error('Informe seu nome.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.');
      if (senha.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
      if (senha !== f.querySelector('#c-senha2').value) throw new Error('As senhas não são iguais.');
      entrou(await api.cadastrar(nome, email, senha));
    });
  },

  '#/2fa'(el, { ir }) {
    const token = sessionStorage.getItem(CHAVE_2FA);
    if (!token) return ir('#/entrar');
    el.innerHTML = cartao('Verificação', 'Digite o código de 6 dígitos do seu app autenticador.', `
      <form novalidate class="form-col">
        <input class="input codigo" id="f-codigo" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" aria-label="Código" required>
        <div class="form-error" role="alert"></div>
        <button class="btn btn-primary btn-block" type="submit">Confirmar</button>
      </form>
      <div class="auth-links"><a href="#/entrar">Voltar</a></div>`);
    const input = el.querySelector('#f-codigo');
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 6); });
    ligar(el, async (f) => {
      const codigo = input.value;
      if (codigo.length !== 6) throw new Error('O código tem 6 dígitos.');
      try {
        entrou(await api.entrar2fa(token, codigo));
      } catch (e) {
        if (e.message.includes('tempo')) sessionStorage.removeItem(CHAVE_2FA);
        throw e;
      }
    });
  },

  '#/esqueci'(el) {
    el.innerHTML = cartao('Esqueci minha senha', 'Enviamos um link para você criar uma senha nova.', `
      <form novalidate class="form-col">
        ${campo('r-email', 'E-mail da conta', 'email', 'autocomplete="email" inputmode="email" placeholder="seu@email.com" required')}
        <div class="form-error" role="alert"></div>
        <button class="btn btn-primary btn-block" type="submit">Enviar link</button>
      </form>
      <div class="auth-links"><a href="#/entrar">Voltar para entrar</a></div>`);
    ligar(el, async (f, erro) => {
      const email = f.querySelector('#r-email').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.');
      const r = await api.esqueciSenha(email);
      erro.classList.add('ok');
      erro.textContent = r.mensagem + ' Confira também a caixa de spam.';
    });
  },

  '#/redefinir'(el, { params, ir }) {
    const token = params.get('token');
    if (!token) return ir('#/esqueci');
    el.innerHTML = cartao('Criar nova senha', '', `
      <form novalidate class="form-col">
        ${campo('n-senha', 'Nova senha', 'password', 'autocomplete="new-password" placeholder="Mínimo 8 caracteres" required')}
        ${campo('n-senha2', 'Confirme a nova senha', 'password', 'autocomplete="new-password" placeholder="Repita a senha" required')}
        <div class="form-error" role="alert"></div>
        <button class="btn btn-primary btn-block" type="submit">Salvar e entrar</button>
      </form>
      <div class="auth-links"><a href="#/esqueci">Pedir outro link</a></div>`);
    ligar(el, async (f) => {
      const senha = f.querySelector('#n-senha').value;
      if (senha.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
      if (senha !== f.querySelector('#n-senha2').value) throw new Error('As senhas não são iguais.');
      sessao.encerrar();
      entrou(await api.redefinirSenha(token, senha));
    });
  },
};

export function render(caminho, el, ctx) {
  TELAS[caminho](el, ctx);
  if (!matchMedia('(pointer: coarse)').matches) el.querySelector('input')?.focus();
}
