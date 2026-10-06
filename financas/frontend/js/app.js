/**
 * app.js — Lógica principal do fin.app
 * Navegação entre telas, renderização de dados e interações do usuário.
 */

import { auth, transacoes, contas, categorias, pluggy } from "./api.js";
import { renderizarGraficoBarras, renderizarGraficoRosca } from "./charts.js";

// ---------------------------------------------------------------------------
// Estado global
// ---------------------------------------------------------------------------
const estado = {
  telaAtual: "home",
  categorias: [],
  filtros: { data_inicio: null, data_fim: null, categoria_id: null, tipo: null, conta_id: null },
};

// ---------------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  if (!auth.estaLogado()) {
    mostrarLogin();
    return;
  }

  registrarServiceWorker();
  configurarNavegacao();
  configurarModalTransacao();
  await carregarHome();
});

function registrarServiceWorker() {
  // Desativado durante desenvolvimento para evitar cache
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
  }
}

// ---------------------------------------------------------------------------
// Tela de Login / Registro
// ---------------------------------------------------------------------------
function mostrarLogin() {
  document.getElementById("app-layout").style.display = "none";
  const wrapper = document.getElementById("login-wrapper");
  wrapper.style.display = "flex";
  renderizarFormLogin(wrapper);
}

function renderizarFormLogin(wrapper, modo = "login") {
  const ehRegistro = modo === "registro";
  wrapper.innerHTML = `
    <div class="login-card">
      <div class="login-titulo">fin<span>.</span>app</div>
      <div class="login-sub">${ehRegistro ? "Crie sua conta" : "Controle financeiro pessoal"}</div>
      <form id="form-auth">
        ${ehRegistro ? `
          <div class="form-group">
            <label class="form-label">Nome</label>
            <input class="form-input" type="text" id="inp-nome" placeholder="Seu nome" required />
          </div>` : ""}
        <div class="form-group">
          <label class="form-label">E-mail</label>
          <input class="form-input" type="email" id="inp-email" placeholder="seu@email.com" required />
        </div>
        <div class="form-group">
          <label class="form-label">Senha</label>
          <input class="form-input" type="password" id="inp-senha" placeholder="••••••••" required />
        </div>
        <button class="btn-primary" type="submit" id="btn-auth">
          ${ehRegistro ? "Criar conta" : "Entrar"}
        </button>
        <div class="form-erro" id="auth-erro"></div>
      </form>
      <div class="form-toggle">
        ${ehRegistro
          ? `Já tem conta? <a id="toggle-modo">Entrar</a>`
          : `Não tem conta? <a id="toggle-modo">Criar conta</a>`}
      </div>
    </div>
  `;

  document.getElementById("toggle-modo").addEventListener("click", () => {
    renderizarFormLogin(wrapper, ehRegistro ? "login" : "registro");
  });

  document.getElementById("form-auth").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btn-auth");
    btn.disabled = true;
    btn.textContent = "Aguarde...";
    document.getElementById("auth-erro").textContent = "";

    try {
      const email = document.getElementById("inp-email").value;
      const senha = document.getElementById("inp-senha").value;

      if (ehRegistro) {
        const nome = document.getElementById("inp-nome").value;
        await auth.registro(nome, email, senha);
      } else {
        const resultado = await auth.login(email, senha);
        if (resultado.requires_2fa) {
          renderizarForm2FA(wrapper, resultado.temp_token);
          return;
        }
      }

      window.location.reload();
    } catch (err) {
      document.getElementById("auth-erro").textContent = err.message;
      btn.disabled = false;
      btn.textContent = ehRegistro ? "Criar conta" : "Entrar";
    }
  });
}

// ---------------------------------------------------------------------------
// Tela de verificação 2FA
// ---------------------------------------------------------------------------
function renderizarForm2FA(wrapper, tempToken) {
  wrapper.innerHTML = `
    <div class="login-card">
      <div class="login-titulo">fin<span>.</span>app</div>
      <div class="login-sub">Verificação em duas etapas</div>
      <p style="font-size:.82rem;color:var(--muted);margin-bottom:20px">
        Abra o Google Authenticator e digite o código de 6 dígitos.
      </p>
      <form id="form-2fa">
        <div class="form-group">
          <label class="form-label">Código</label>
          <input class="form-input mono" type="text" id="inp-codigo"
            placeholder="000000" maxlength="6" inputmode="numeric"
            style="font-size:1.4rem;letter-spacing:8px;text-align:center" required />
        </div>
        <button class="btn-primary" type="submit" id="btn-2fa">Verificar</button>
        <div class="form-erro" id="erro-2fa"></div>
      </form>
    </div>
  `;

  document.getElementById("form-2fa").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btn-2fa");
    btn.disabled = true;
    btn.textContent = "Verificando...";
    document.getElementById("erro-2fa").textContent = "";

    try {
      const codigo = document.getElementById("inp-codigo").value;
      await auth.verificar2fa(tempToken, codigo);
      window.location.reload();
    } catch (err) {
      document.getElementById("erro-2fa").textContent = err.message;
      btn.disabled = false;
      btn.textContent = "Verificar";
    }
  });
}

// ---------------------------------------------------------------------------
// Navegação
// ---------------------------------------------------------------------------
function configurarNavegacao() {
  const itens = document.querySelectorAll("[data-tela]");
  itens.forEach((item) => {
    item.addEventListener("click", () => {
      const tela = item.dataset.tela;
      navegarPara(tela);
    });
  });
}

function navegarPara(tela) {
  estado.telaAtual = tela;

  // Atualiza itens ativos
  document.querySelectorAll("[data-tela]").forEach((el) =>
    el.classList.toggle("active", el.dataset.tela === tela)
  );

  // Mostra/esconde telas
  document.querySelectorAll(".tela").forEach((el) =>
    el.classList.toggle("ativa", el.id === `tela-${tela}`)
  );

  // Carrega dados da tela
  switch (tela) {
    case "home":         carregarHome();        break;
    case "transacoes":   carregarTransacoes();  break;
    case "contas":       carregarContas();      break;
    case "config":       carregarConfig();      break;
  }
}

// ---------------------------------------------------------------------------
// Tela: Home
// ---------------------------------------------------------------------------
async function carregarHome() {
  mostrarSkeletons();

  try {
    const [resumo, evolucao, ultimas, cats] = await Promise.all([
      transacoes.resumo(),
      transacoes.evolucaoMensal(6),
      transacoes.listar({ limite: 8 }),
      categorias.listar(),
    ]);

    estado.categorias = cats;

    renderizarKPIs(resumo);
    renderizarGraficoBarras("grafico-barras", evolucao);
    renderizarGraficoRosca("grafico-rosca", resumo.gastos_por_categoria);
    renderizarUltimasTransacoes(ultimas);
    atualizarBadgeSync();
  } catch (err) {
    exibirToast("Erro ao carregar dados: " + err.message, "erro");
  }
}

function mostrarSkeletons() {
  const grid = document.getElementById("kpi-grid");
  if (!grid) return;
  grid.innerHTML = Array(4)
    .fill('<div class="kpi-card skeleton skeleton-kpi"></div>')
    .join("");
}

function renderizarKPIs(resumo) {
  const { saldo_total, mes_atual, mes_anterior } = resumo;
  const economia = mes_atual.receitas > 0
    ? ((mes_atual.receitas - mes_atual.gastos) / mes_atual.receitas) * 100
    : 0;

  const deltaReceitas = calcDelta(mes_atual.receitas, mes_anterior.receitas);
  const deltaGastos   = calcDelta(mes_atual.gastos,   mes_anterior.gastos);

  const grid = document.getElementById("kpi-grid");
  grid.innerHTML = `
    ${kpiCard("Saldo Total",   saldo_total, "destaque", null)}
    ${kpiCard("Receitas",      mes_atual.receitas, "positivo", deltaReceitas)}
    ${kpiCard("Gastos",        mes_atual.gastos,   "negativo", deltaGastos, true)}
    ${kpiCard("% Economia",    economia, "destaque", null, false, true)}
  `;
}

function kpiCard(label, valor, classe, delta, gastos = false, percent = false) {
  const formatado = percent
    ? `${valor.toFixed(1)}%`
    : formatarMoeda(valor);

  let deltaHTML = "";
  if (delta !== null) {
    const direcao = gastos ? (delta.valor > 0 ? "down" : "up") : (delta.valor > 0 ? "up" : "down");
    const seta    = delta.valor > 0 ? "↑" : "↓";
    deltaHTML = `<div class="kpi-delta ${direcao}">${seta} ${Math.abs(delta.pct).toFixed(1)}% vs mês anterior</div>`;
  }

  return `
    <div class="kpi-card">
      <div class="kpi-label">${label}</div>
      <div class="kpi-valor mono ${classe}">${formatado}</div>
      ${deltaHTML}
    </div>`;
}

function calcDelta(atual, anterior) {
  const valor = atual - anterior;
  const pct   = anterior !== 0 ? (valor / anterior) * 100 : 0;
  return { valor, pct };
}

function renderizarUltimasTransacoes(lista) {
  const container = document.getElementById("ultimas-transacoes");
  if (!container) return;

  if (!lista.length) {
    container.innerHTML = `<div class="transacao-row" style="color:var(--muted);justify-content:center">Nenhuma transação encontrada</div>`;
    return;
  }

  container.innerHTML = lista.map(renderizarLinhaTransacao).join("");
}

// ---------------------------------------------------------------------------
// Tela: Transações
// ---------------------------------------------------------------------------
async function carregarTransacoes() {
  const container = document.getElementById("lista-transacoes");
  if (!container) return;

  container.innerHTML = `<div class="skeleton skeleton-row" style="margin:8px 0;border-radius:8px;height:48px"></div>`.repeat(6);

  const cats = estado.categorias.length
    ? estado.categorias
    : await categorias.listar().then((c) => { estado.categorias = c; return c; });

  // Monta os selects de filtro
  const selectCat = document.getElementById("filtro-categoria");
  if (selectCat && !selectCat.querySelector("option[value]")) {
    cats.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.nome;
      selectCat.appendChild(opt);
    });
  }

  // Aplica os filtros e busca
  const dados = await transacoes.listar(estado.filtros);
  container.innerHTML = dados.length
    ? dados.map(renderizarLinhaTransacao).join("")
    : `<div class="transacao-row" style="color:var(--muted);justify-content:center">Nenhuma transação no período</div>`;
}

function configurarFiltros() {
  const aplicar = () => {
    estado.filtros.data_inicio = document.getElementById("filtro-inicio")?.value || null;
    estado.filtros.data_fim    = document.getElementById("filtro-fim")?.value    || null;
    estado.filtros.categoria_id = document.getElementById("filtro-categoria")?.value || null;
    estado.filtros.tipo        = document.getElementById("filtro-tipo")?.value   || null;
    carregarTransacoes();
  };

  ["filtro-inicio", "filtro-fim", "filtro-categoria", "filtro-tipo"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", aplicar);
  });
}

// ---------------------------------------------------------------------------
// Tela: Contas
// ---------------------------------------------------------------------------
async function carregarContas() {
  const grid = document.getElementById("contas-grid");
  if (!grid) return;

  grid.innerHTML = Array(3).fill(
    `<div class="conta-card skeleton" style="height:120px"></div>`
  ).join("");

  try {
    const lista = await contas.listar();
    grid.innerHTML = lista.length
      ? lista.map(renderizarCartaoConta).join("")
      : `<p style="color:var(--muted)">Nenhuma conta conectada. Vá em Configurações para conectar seu banco.</p>`;
  } catch (err) {
    exibirToast("Erro ao carregar contas: " + err.message, "erro");
  }
}

function renderizarCartaoConta(conta) {
  const sync = conta.ultima_sync
    ? new Date(conta.ultima_sync).toLocaleString("pt-BR")
    : "Nunca";

  return `
    <div class="conta-card">
      <div class="conta-header">
        <div>
          <div class="conta-banco">${conta.instituicao}</div>
          <div class="conta-tipo">${conta.tipo}</div>
        </div>
        <i class="ti ti-building-bank" style="color:var(--muted);font-size:1.2rem"></i>
      </div>
      <div class="conta-saldo mono">${formatarMoeda(conta.saldo_atual)}</div>
      <div class="conta-nome" style="color:var(--muted);font-size:.78rem;margin-bottom:8px">${conta.nome}</div>
      <div class="conta-sync">
        <span class="conta-sync-dot"></span>
        Sincronizado em ${sync}
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Tela: Configurações
// ---------------------------------------------------------------------------
async function carregarConfig() {
  document.getElementById("btn-conectar-banco")?.addEventListener("click", async () => {
    try {
      const { connectToken } = await pluggy.connectToken();
      abrirPluggyConnect(connectToken);
    } catch (err) {
      exibirToast("Erro ao obter token de conexão: " + err.message, "erro");
    }
  });

  document.getElementById("btn-sync-manual")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-sync-manual");
    btn.disabled = true;
    btn.textContent = "Sincronizando...";
    try {
      await pluggy.sincronizar();
      exibirToast("Sincronização concluída!", "sucesso");
      atualizarBadgeSync();
    } catch (err) {
      exibirToast("Erro: " + err.message, "erro");
    } finally {
      btn.disabled = false;
      btn.textContent = "Sincronizar agora";
    }
  });

  document.getElementById("btn-logout")?.addEventListener("click", () => {
    auth.logout();
  });

  // 2FA
  const btn2fa = document.getElementById("btn-2fa");
  btn2fa?.addEventListener("click", async () => {
    const qrContainer = document.getElementById("qrcode-container");
    if (qrContainer.style.display === "block") {
      qrContainer.style.display = "none";
      btn2fa.textContent = "Ativar 2FA";
      return;
    }

    btn2fa.disabled = true;
    btn2fa.textContent = "Gerando QR Code...";
    try {
      const { qr_code } = await auth.ativar2fa();
      document.getElementById("qrcode-img").src = qr_code;
      qrContainer.style.display = "block";
      btn2fa.textContent = "Cancelar";
      btn2fa.disabled = false;
    } catch (err) {
      exibirToast("Erro ao ativar 2FA: " + err.message, "erro");
      btn2fa.disabled = false;
      btn2fa.textContent = "Ativar 2FA";
    }
  });

  document.getElementById("btn-confirmar-2fa")?.addEventListener("click", async () => {
    const codigo = document.getElementById("inp-codigo-2fa").value;
    const erroEl = document.getElementById("erro-confirmar-2fa");
    erroEl.textContent = "";

    try {
      await auth.confirmar2fa(codigo);
      exibirToast("2FA ativado com sucesso!", "sucesso");
      document.getElementById("qrcode-container").style.display = "none";
      document.getElementById("btn-2fa").textContent = "Desativar 2FA";
      document.getElementById("desc-2fa").textContent = "2FA ativo — sua conta está protegida.";
    } catch (err) {
      erroEl.textContent = err.message;
    }
  });
}

function abrirPluggyConnect(token) {
  // Abre o Pluggy Connect via URL com o connect token
  const url = `https://connect.pluggy.ai/?connectToken=${token}`;

  const overlay = document.createElement("div");
  overlay.id = "pluggy-overlay";
  overlay.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    background:rgba(0,0,0,.7);z-index:9999;
    display:flex;align-items:center;justify-content:center;
  `;

  const iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.style.cssText = `
    width:100%;max-width:480px;height:700px;max-height:90vh;
    border:none;border-radius:16px;
  `;

  const fechar = document.createElement("button");
  fechar.textContent = "✕ Fechar";
  fechar.style.cssText = `
    position:absolute;top:16px;right:16px;
    background:var(--surface);color:var(--text);
    border:1px solid var(--border);border-radius:8px;
    padding:8px 16px;cursor:pointer;font-size:.85rem;
  `;

  fechar.onclick = () => {
    document.body.removeChild(overlay);
    // Tenta sincronizar após fechar
    pluggy.sincronizar().then(() => carregarContas()).catch(() => {});
  };

  overlay.appendChild(iframe);
  overlay.appendChild(fechar);
  document.body.appendChild(overlay);
}

// ---------------------------------------------------------------------------
// Badge de sincronização
// ---------------------------------------------------------------------------
function atualizarBadgeSync() {
  const badges = document.querySelectorAll(".sync-badge-texto");
  const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  badges.forEach((b) => (b.textContent = `sincronizado ${hora}`));
}

// ---------------------------------------------------------------------------
// Helpers de renderização
// ---------------------------------------------------------------------------
function renderizarLinhaTransacao(t) {
  const cat     = t.categorias || { nome: "Outros", cor: "#e05c5c", icone: "tag" };
  const isCredit = t.tipo === "CREDIT";
  const valor    = formatarMoeda(t.valor);
  const data     = new Date(t.data + "T00:00:00").toLocaleDateString("pt-BR");
  const badgeCls = gerarClasseBadge(cat.nome);

  return `
    <div class="transacao-row">
      <div class="transacao-icone" style="background:${cat.cor}22;color:${cat.cor}">
        <i class="ti ti-${cat.icone || "tag"}"></i>
      </div>
      <div class="transacao-info">
        <div class="transacao-descricao">${t.descricao}</div>
        <div class="transacao-meta">
          ${data} · ${t.instituicao || t.contas?.instituicao || ""}
          <span class="badge ${badgeCls}" style="margin-left:6px">${cat.nome}</span>
        </div>
      </div>
      <div class="transacao-valor ${isCredit ? "credit" : "debit"}">
        ${isCredit ? "+" : "-"}${valor}
      </div>
    </div>`;
}

function gerarClasseBadge(nomeCategoria) {
  const mapa = {
    "Alimentação": "badge-alimentacao",
    "Receita":     "badge-receita",
    "Transporte":  "badge-transporte",
  };
  return mapa[nomeCategoria] || "badge-outros";
}

function formatarMoeda(valor) {
  return (valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
function exibirToast(mensagem, tipo = "sucesso") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${tipo}`;
  toast.textContent = mensagem;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 4000);
}

// ---------------------------------------------------------------------------
// Modal: Nova Transação Manual
// ---------------------------------------------------------------------------
function configurarModalTransacao() {
  const modal   = document.getElementById("modal-transacao");
  const btnFab  = document.getElementById("btn-nova-transacao");
  const btnFechar = document.getElementById("modal-fechar");
  const btnSalvar = document.getElementById("modal-salvar");
  const erroEl  = document.getElementById("modal-erro");

  // Define data padrão como hoje
  const hoje = new Date().toISOString().split("T")[0];
  document.getElementById("modal-data").value = hoje;

  // Abre modal
  btnFab.addEventListener("click", async () => {
    modal.style.display = "flex";
    document.getElementById("modal-valor").focus();

    // Preenche categorias se ainda não preencheu
    const select = document.getElementById("modal-categoria");
    if (select.options.length <= 1) {
      const cats = estado.categorias.length
        ? estado.categorias
        : await categorias.listar().then((c) => { estado.categorias = c; return c; });
      cats.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.nome;
        select.appendChild(opt);
      });
    }
  });

  // Fecha modal
  btnFechar.addEventListener("click", fecharModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) fecharModal(); });

  function fecharModal() {
    modal.style.display = "none";
    erroEl.textContent = "";
  }

  // Tipo toggle (Gasto / Receita)
  document.querySelectorAll(".tipo-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tipo-btn").forEach((b) => b.classList.remove("ativo"));
      btn.classList.add("ativo");
    });
  });

  // Salvar
  btnSalvar.addEventListener("click", async () => {
    erroEl.textContent = "";

    const valor = parseFloat(document.getElementById("modal-valor").value);
    const descricao = document.getElementById("modal-descricao").value.trim();
    const data = document.getElementById("modal-data").value;
    const tipo = document.querySelector(".tipo-btn.ativo")?.dataset.tipo || "DEBIT";
    const categoria_id = document.getElementById("modal-categoria").value || null;

    if (!valor || valor <= 0) { erroEl.textContent = "Informe um valor válido."; return; }
    if (!descricao)           { erroEl.textContent = "Informe uma descrição."; return; }
    if (!data)                { erroEl.textContent = "Informe a data."; return; }

    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";

    try {
      await transacoes.criar({ descricao, valor, tipo, data, categoria_id });
      exibirToast("Transação salva!", "sucesso");
      fecharModal();

      // Limpa campos
      document.getElementById("modal-valor").value = "";
      document.getElementById("modal-descricao").value = "";
      document.getElementById("modal-data").value = new Date().toISOString().split("T")[0];
      document.querySelectorAll(".tipo-btn").forEach((b) => b.classList.remove("ativo"));
      document.querySelector('.tipo-btn[data-tipo="DEBIT"]').classList.add("ativo");

      // Atualiza a tela atual
      if (estado.telaAtual === "home") carregarHome();
      else if (estado.telaAtual === "transacoes") carregarTransacoes();
    } catch (err) {
      erroEl.textContent = err.message;
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.innerHTML = '<i class="ti ti-check"></i> Salvar';
    }
  });
}

// ---------------------------------------------------------------------------
// Inicia listeners dos filtros após o DOM estar pronto
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  configurarFiltros();
});
