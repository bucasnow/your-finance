const CHAVE_TOKEN = 'fin.sessao';
const CHAVE_USUARIO = 'fin.usuario';
const TEMPO_LIMITE = 75000;
const AVISO_LENTO = 3500;

const base = () => window.FIN_CONFIG.apiBase;

function ler(chave) { try { return localStorage.getItem(chave); } catch { return null; } }
function gravar(chave, valor) { try { valor == null ? localStorage.removeItem(chave) : localStorage.setItem(chave, valor); } catch { /* modo privado */ } }

export const sessao = {
  get token() { return ler(CHAVE_TOKEN); },
  get usuario() { try { return JSON.parse(ler(CHAVE_USUARIO)) || null; } catch { return null; } },
  iniciar({ access_token, usuario }) { gravar(CHAVE_TOKEN, access_token); gravar(CHAVE_USUARIO, JSON.stringify(usuario)); },
  atualizarUsuario(usuario) { gravar(CHAVE_USUARIO, JSON.stringify(usuario)); },
  encerrar() {
    gravar(CHAVE_TOKEN, null);
    gravar(CHAVE_USUARIO, null);
    ['finapp_token', 'fin.username'].forEach((k) => gravar(k, null));
  },
};

export class ErroApi extends Error {
  constructor(mensagem, status = 0) { super(mensagem); this.status = status; }
}

let pendentesLentas = 0;
function sinalLento(delta) {
  pendentesLentas += delta;
  document.dispatchEvent(new CustomEvent('fin:lento', { detail: pendentesLentas > 0 }));
}

async function req(metodo, caminho, corpo, { autenticado = true } = {}) {
  const token = autenticado ? sessao.token : null;
  if (autenticado && !token) {
    document.dispatchEvent(new CustomEvent('fin:sair'));
    throw new ErroApi('Entre na sua conta para continuar.', 401);
  }

  const ctrl = new AbortController();
  const limite = setTimeout(() => ctrl.abort(), TEMPO_LIMITE);
  let lento = false;
  const aviso = setTimeout(() => { lento = true; sinalLento(+1); }, AVISO_LENTO);

  let res;
  try {
    res = await fetch(base() + caminho, {
      method: metodo,
      headers: {
        ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new ErroApi(e.name === 'AbortError'
      ? 'O servidor demorou demais para responder. Tente de novo.'
      : 'Sem conexão com o servidor. Verifique sua internet e tente de novo.');
  } finally {
    clearTimeout(limite);
    clearTimeout(aviso);
    if (lento) sinalLento(-1);
  }

  const json = res.status === 204 ? null : await res.json().catch(() => null);
  const mensagem = (typeof json?.detail === 'string' && json.detail) || (res.status >= 500 ? 'Erro no servidor. Tente novamente em instantes.' : 'Algo deu errado. Tente de novo.');

  if (res.status === 401 && token) {
    // Só encerra se a resposta for da sessão atual; respostas atrasadas de uma sessão antiga são ignoradas
    if (token === sessao.token) {
      sessao.encerrar();
      document.dispatchEvent(new CustomEvent('fin:sair', { detail: mensagem }));
    }
    throw new ErroApi(mensagem, 401);
  }
  if (!res.ok) throw new ErroApi(mensagem, res.status);
  return json;
}

let cacheCategorias = null;

export const api = {
  // Conta
  cadastrar: (nome, email, senha) => req('POST', '/auth/cadastro', { nome, email, senha }, { autenticado: false }),
  entrar: (email, senha) => req('POST', '/auth/login', { email, senha }, { autenticado: false }),
  entrar2fa: (token_2fa, codigo) => req('POST', '/auth/login/2fa', { token_2fa, codigo }, { autenticado: false }),
  esqueciSenha: (email) => req('POST', '/auth/senha/esqueci', { email }, { autenticado: false }),
  redefinirSenha: (token, nova_senha) => req('POST', '/auth/senha/redefinir', { token, nova_senha }, { autenticado: false }),
  eu: () => req('GET', '/auth/me'),
  alterarSenha: (senha_atual, nova_senha) => req('POST', '/auth/senha/alterar', { senha_atual, nova_senha }),
  iniciar2fa: () => req('POST', '/auth/2fa/iniciar'),
  ativar2fa: (codigo) => req('POST', '/auth/2fa/ativar', { codigo }),
  desativar2fa: (senha) => req('POST', '/auth/2fa/desativar', { senha }),

  // Dados
  resumo: (mes) => req('GET', `/resumo?mes=${mes}`),
  lancamentos: (mes) => req('GET', `/transacoes?mes=${mes}`),
  criarLancamento: (dados) => req('POST', '/transacoes', dados),
  editarLancamento: (id, dados) => req('PUT', `/transacoes/${id}`, dados),
  excluirLancamento: (id, todasParcelas = false) => req('DELETE', `/transacoes/${id}?todas_parcelas=${todasParcelas}`),

  recorrencias: () => req('GET', '/recorrencias'),
  tornarRecorrente: (id, dados) => req('POST', `/transacoes/${id}/recorrencia`, dados),
  pararRecorrencia: (id) => req('POST', `/recorrencias/${id}/parar`),

  analisarFaturas: (arquivos) => req('POST', '/importacao/analisar', { arquivos }),
  confirmarImportacao: (dados) => req('POST', '/importacao/confirmar', dados),

  async categorias({ recarregar = false } = {}) {
    if (!cacheCategorias || recarregar) cacheCategorias = req('GET', '/categorias').catch((e) => { cacheCategorias = null; throw e; });
    return cacheCategorias;
  },
  criarCategoria: async (dados) => { const c = await req('POST', '/categorias', dados); cacheCategorias = null; return c; },
  excluirCategoria: async (id) => { await req('DELETE', `/categorias/${id}`); cacheCategorias = null; },
  limparCache: () => { cacheCategorias = null; },

  cartoes: () => req('GET', '/cartoes'),
  criarCartao: (dados) => req('POST', '/cartoes', dados),
  editarCartao: (id, dados) => req('PUT', `/cartoes/${id}`, dados),
  excluirCartao: (id) => req('DELETE', `/cartoes/${id}`),
  fatura: (id, mes) => req('GET', `/cartoes/${id}/fatura${mes ? `?mes=${mes}` : ''}`),

  investimentos: () => req('GET', '/investimentos'),
  criarInvestimento: (dados) => req('POST', '/investimentos', dados),
  editarInvestimento: (id, dados) => req('PUT', `/investimentos/${id}`, dados),
  excluirInvestimento: (id) => req('DELETE', `/investimentos/${id}`),
};
