/**
 * api.js — Camada de comunicação com o backend FastAPI.
 * Todas as requisições autenticadas passam pelo token JWT salvo no localStorage.
 */

const API_BASE = "https://web-production-2dec0.up.railway.app"; // Backend no Railway

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------
function getToken() {
  return localStorage.getItem("finapp_token");
}

function setToken(token) {
  localStorage.setItem("finapp_token", token);
}

function removeToken() {
  localStorage.removeItem("finapp_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const resp = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (resp.status === 401) {
    removeToken();
    window.location.reload();
    return;
  }

  if (!resp.ok) {
    const erro = await resp.json().catch(() => ({ detail: "Erro desconhecido" }));
    throw new Error(erro.detail || "Erro na requisição");
  }

  return resp.json();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const auth = {
  async login(email, senha) {
    const body = new URLSearchParams({ username: email, password: senha });
    const resp = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!resp.ok) {
      const erro = await resp.json();
      throw new Error(erro.detail || "Credenciais inválidas");
    }
    const data = await resp.json();
    // Se 2FA ativo, retorna sem salvar token ainda
    if (data.requires_2fa) return data;
    setToken(data.access_token);
    return data;
  },

  async verificar2fa(tempToken, codigo) {
    const resp = await fetch(`${API_BASE}/auth/verificar-2fa`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tempToken}`,
      },
      body: JSON.stringify({ codigo }),
    });
    if (!resp.ok) {
      const erro = await resp.json();
      throw new Error(erro.detail || "Código inválido");
    }
    const data = await resp.json();
    setToken(data.access_token);
    return data;
  },

  async ativar2fa() {
    return request("/auth/ativar-2fa", { method: "POST" });
  },

  async confirmar2fa(codigo) {
    return request("/auth/confirmar-2fa", {
      method: "POST",
      body: JSON.stringify({ codigo }),
    });
  },

  async desativar2fa() {
    return request("/auth/desativar-2fa", { method: "POST" });
  },

  setToken,

  async registro(nome, email, senha) {
    const data = await request("/auth/registro", {
      method: "POST",
      body: JSON.stringify({ nome, email, senha }),
    });
    setToken(data.access_token);
    return data;
  },

  logout() {
    removeToken();
    window.location.reload();
  },

  estaLogado() {
    return !!getToken();
  },

  async me() {
    return request("/auth/me");
  },
};

// ---------------------------------------------------------------------------
// Transações
// ---------------------------------------------------------------------------
export const transacoes = {
  async criar(dados) {
    return request("/transacoes", {
      method: "POST",
      body: JSON.stringify(dados),
    });
  },

  async listar(filtros = {}) {
    const params = new URLSearchParams();
    if (filtros.data_inicio) params.set("data_inicio", filtros.data_inicio);
    if (filtros.data_fim)    params.set("data_fim",    filtros.data_fim);
    if (filtros.categoria_id) params.set("categoria_id", filtros.categoria_id);
    if (filtros.tipo)        params.set("tipo",        filtros.tipo);
    if (filtros.conta_id)    params.set("conta_id",    filtros.conta_id);
    if (filtros.limite)      params.set("limite",      filtros.limite);
    if (filtros.pagina)      params.set("pagina",      filtros.pagina);
    return request(`/transacoes?${params}`);
  },

  async resumo() {
    return request("/transacoes/resumo");
  },

  async evolucaoMensal(meses = 6) {
    return request(`/transacoes/evolucao-mensal?meses=${meses}`);
  },
};

// ---------------------------------------------------------------------------
// Contas
// ---------------------------------------------------------------------------
export const contas = {
  async listar() {
    return request("/contas");
  },
};

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------
export const categorias = {
  async listar() {
    return request("/categorias");
  },
};

// ---------------------------------------------------------------------------
// Pluggy
// ---------------------------------------------------------------------------
export const pluggy = {
  async connectToken() {
    return request("/pluggy/connect-token");
  },

  async sincronizar() {
    return request("/pluggy/sync", { method: "POST" });
  },
};
