"""
fin.app — Backend FastAPI
Ponto de entrada principal: rotas de auth, transações, contas e Pluggy.
"""

import base64
import io
import logging
import os
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

try:
    import resend as resend_sdk
    RESEND_AVAILABLE = True
except ImportError:
    RESEND_AVAILABLE = False

import pyotp
import qrcode

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr

from auth import criar_token, decodificar_token, hash_senha, oauth2_scheme, usuario_atual, verificar_senha
from database import supabase
from pluggy import gerar_connect_token, listar_itens
from scheduler import iniciar_scheduler, scheduler

load_dotenv()

# ---------------------------------------------------------------------------
# Configuração de logging com timestamp
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5500")
FRONTEND_ORIGINS = [
    FRONTEND_ORIGIN,
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
]


# ---------------------------------------------------------------------------
# Lifespan: inicia e encerra o scheduler junto com o app
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    iniciar_scheduler()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="fin.app API", version="1.0.0", lifespan=lifespan)

# CORS deve ser o PRIMEIRO middleware (mais externo)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Schemas Pydantic
# ---------------------------------------------------------------------------
class RegistroUsuario(BaseModel):
    nome: str
    email: EmailStr
    senha: str


class RespostaToken(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------------------------------------------------------------------------
# Rotas de Autenticação
# ---------------------------------------------------------------------------
@app.post("/auth/registro", status_code=status.HTTP_201_CREATED)
async def registrar(dados: RegistroUsuario):
    """Cria um novo usuário com senha hasheada em bcrypt."""
    # Verifica se e-mail já existe
    existente = supabase.table("usuarios").select("id").eq("email", dados.email).execute()
    if existente.data:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    resultado = supabase.table("usuarios").insert({
        "nome": dados.nome,
        "email": dados.email,
        "senha_hash": hash_senha(dados.senha),
    }).execute()

    usuario = resultado.data[0]
    token = criar_token({"sub": usuario["id"], "email": usuario["email"]})
    logger.info(f"Novo usuário registrado: {dados.email}")
    return {"access_token": token, "token_type": "bearer"}


@app.post("/auth/login")
async def login(form: OAuth2PasswordRequestForm = Depends()):
    """
    Autentica usuário. Se 2FA estiver ativo, retorna `requires_2fa: true`
    e um token temporário. O cliente deve então chamar /auth/verificar-2fa.
    """
    resultado = supabase.table("usuarios").select("*").eq("email", form.username).execute()
    if not resultado.data:
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    usuario = resultado.data[0]
    if not verificar_senha(form.password, usuario["senha_hash"]):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    # Se 2FA estiver ativo, retorna token temporário (válido por 5 min)
    if usuario.get("totp_ativo"):
        token_temp = criar_token(
            {"sub": usuario["id"], "email": usuario["email"], "totp_pendente": True},
            expira_em=__import__("datetime").timedelta(minutes=5)
        )
        logger.info(f"Login 2FA pendente: {form.username}")
        return {"requires_2fa": True, "temp_token": token_temp}

    token = criar_token({"sub": usuario["id"], "email": usuario["email"]})
    logger.info(f"Login: {form.username}")
    return {"access_token": token, "token_type": "bearer"}


class Verificar2FA(BaseModel):
    codigo: str


@app.post("/auth/verificar-2fa", response_model=RespostaToken)
async def verificar_2fa(dados: Verificar2FA, token: str = Depends(oauth2_scheme)):
    """Valida o código TOTP e retorna o JWT definitivo."""
    payload = decodificar_token(token)

    if not payload.get("totp_pendente"):
        raise HTTPException(status_code=400, detail="Token inválido para 2FA")

    resultado = supabase.table("usuarios").select("totp_secret").eq("id", payload["sub"]).execute()
    if not resultado.data:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    secret = resultado.data[0]["totp_secret"]
    totp = pyotp.TOTP(secret)

    if not totp.verify(dados.codigo, valid_window=1):
        raise HTTPException(status_code=401, detail="Código inválido ou expirado")

    token_final = criar_token({"sub": payload["sub"], "email": payload["email"]})
    logger.info(f"2FA verificado: {payload['email']}")
    return {"access_token": token_final, "token_type": "bearer"}


@app.post("/auth/ativar-2fa")
async def ativar_2fa(usuario: dict = Depends(usuario_atual)):
    """Gera o secret TOTP e retorna o QR Code em base64 para o usuário escanear."""
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)

    # Salva o secret (2FA ainda não ativo até confirmar)
    supabase.table("usuarios").update({"totp_secret": secret}).eq("id", usuario["sub"]).execute()

    # Gera QR Code
    uri = totp.provisioning_uri(name=usuario["email"], issuer_name="fin.app")
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_base64 = base64.b64encode(buf.getvalue()).decode()

    return {"qr_code": f"data:image/png;base64,{qr_base64}", "secret": secret}


@app.post("/auth/confirmar-2fa")
async def confirmar_2fa(dados: Verificar2FA, usuario: dict = Depends(usuario_atual)):
    """Confirma o código TOTP e ativa o 2FA definitivamente."""
    resultado = supabase.table("usuarios").select("totp_secret").eq("id", usuario["sub"]).execute()
    if not resultado.data or not resultado.data[0].get("totp_secret"):
        raise HTTPException(status_code=400, detail="2FA não foi configurado ainda")

    secret = resultado.data[0]["totp_secret"]
    totp = pyotp.TOTP(secret)

    if not totp.verify(dados.codigo, valid_window=1):
        raise HTTPException(status_code=401, detail="Código inválido")

    supabase.table("usuarios").update({"totp_ativo": True}).eq("id", usuario["sub"]).execute()
    logger.info(f"2FA ativado: {usuario['email']}")
    return {"mensagem": "2FA ativado com sucesso"}


@app.post("/auth/desativar-2fa")
async def desativar_2fa(usuario: dict = Depends(usuario_atual)):
    """Desativa o 2FA do usuário."""
    supabase.table("usuarios").update({"totp_ativo": False, "totp_secret": None}).eq("id", usuario["sub"]).execute()
    logger.info(f"2FA desativado: {usuario['email']}")
    return {"mensagem": "2FA desativado"}


FRONTEND_URL = os.getenv("FRONTEND_URL", "https://majestic-profiterole-cd413f.netlify.app")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "fin.app <onboarding@resend.dev>")


@app.post("/auth/solicitar-reset")
async def solicitar_reset(dados: dict):
    """Gera token de reset e envia e-mail com link."""
    email = dados.get("email", "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Informe o e-mail")
    resultado = supabase.table("usuarios").select("id, nome").eq("email", email).execute()
    if not resultado.data:
        # Não revelar se e-mail existe ou não (segurança)
        return {"mensagem": "Se o e-mail estiver cadastrado, você receberá um link em breve."}
    usuario = resultado.data[0]
    token = secrets.token_urlsafe(32)
    expira = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    supabase.table("usuarios").update({
        "reset_token": token,
        "reset_token_expires": expira,
    }).eq("id", usuario["id"]).execute()
    link = f"{FRONTEND_URL}/#/reset?token={token}"
    nome = usuario.get("nome") or "usuário"
    if RESEND_API_KEY and RESEND_AVAILABLE:
        resend_sdk.api_key = RESEND_API_KEY
        resend_sdk.Emails.send({
            "from": FROM_EMAIL,
            "to": [email],
            "subject": "Redefinir senha — fin.app",
            "html": f"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
              <h2 style="color:#34D399">fin.app</h2>
              <p>Olá, <strong>{nome}</strong>!</p>
              <p>Recebemos uma solicitação para redefinir sua senha.</p>
              <p style="margin:24px 0">
                <a href="{link}" style="background:#34D399;color:#0A101C;padding:12px 24px;border-radius:8px;font-weight:700;text-decoration:none">
                  Redefinir minha senha
                </a>
              </p>
              <p style="color:#888;font-size:13px">O link expira em 1 hora. Se não foi você, ignore este e-mail.</p>
            </div>
            """
        })
    logger.info(f"Reset de senha solicitado: {email}")
    return {"mensagem": "Se o e-mail estiver cadastrado, você receberá um link em breve."}


@app.post("/auth/confirmar-reset")
async def confirmar_reset(dados: dict):
    """Valida token de reset e atualiza a senha."""
    token = dados.get("token", "").strip()
    nova_senha = dados.get("nova_senha", "")
    if not token or len(nova_senha) < 8:
        raise HTTPException(status_code=400, detail="Token inválido ou senha muito curta")
    resultado = supabase.table("usuarios").select("id, reset_token_expires").eq("reset_token", token).execute()
    if not resultado.data:
        raise HTTPException(status_code=400, detail="Link inválido ou já utilizado")
    usuario = resultado.data[0]
    expires = usuario.get("reset_token_expires")
    if expires:
        exp_dt = datetime.fromisoformat(expires.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > exp_dt:
            raise HTTPException(status_code=400, detail="Link expirado. Solicite um novo.")
    supabase.table("usuarios").update({
        "senha_hash": hash_senha(nova_senha),
        "reset_token": None,
        "reset_token_expires": None,
    }).eq("id", usuario["id"]).execute()
    logger.info(f"Senha redefinida via token: {usuario['id']}")
    return {"mensagem": "Senha alterada com sucesso"}


@app.get("/auth/me")
async def me(usuario: dict = Depends(usuario_atual)):
    """Retorna dados do usuário logado."""
    resultado = supabase.table("usuarios").select("id, nome, email").eq("id", usuario["sub"]).execute()
    if not resultado.data:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return resultado.data[0]


# ---------------------------------------------------------------------------
# Rotas de Pluggy
# ---------------------------------------------------------------------------
@app.get("/pluggy/connect-token")
async def connect_token(_: dict = Depends(usuario_atual)):
    """Gera um Connect Token temporário para o Pluggy Connect widget."""
    try:
        token = await gerar_connect_token()
        return {"connectToken": token}
    except Exception as e:
        logger.error(f"Erro ao gerar connect token: {e}")
        raise HTTPException(status_code=502, detail="Erro ao conectar com a Pluggy")


@app.post("/pluggy/sync")
async def sincronizar_manual(_: dict = Depends(usuario_atual)):
    """Dispara uma sincronização manual imediata."""
    logger.info("Sincronização manual solicitada")
    try:
        from scheduler import sincronizar_transacoes as sync
        await sync()
        return {"status": "ok", "mensagem": "Sincronização concluída"}
    except Exception as e:
        logger.error(f"Erro na sincronização manual: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Rotas de Contas
# ---------------------------------------------------------------------------
@app.get("/contas")
async def listar_contas(_: dict = Depends(usuario_atual)):
    """Lista todas as contas salvas no Supabase."""
    resultado = supabase.table("contas").select("*").order("instituicao").execute()
    return resultado.data


@app.get("/contas/{conta_id}")
async def obter_conta(conta_id: str, _: dict = Depends(usuario_atual)):
    resultado = supabase.table("contas").select("*").eq("id", conta_id).execute()
    if not resultado.data:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    return resultado.data[0]


# ---------------------------------------------------------------------------
# Rotas de Transações
# ---------------------------------------------------------------------------
@app.get("/transacoes")
async def listar_transacoes(
    _: dict = Depends(usuario_atual),
    data_inicio: Optional[str] = Query(None, description="YYYY-MM-DD"),
    data_fim: Optional[str] = Query(None, description="YYYY-MM-DD"),
    categoria_id: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None, description="CREDIT ou DEBIT"),
    conta_id: Optional[str] = Query(None),
    limite: int = Query(100, ge=1, le=500),
    pagina: int = Query(1, ge=1),
):
    """Lista transações com filtros opcionais e paginação."""
    query = supabase.table("transacoes").select(
        "*, categorias(nome, cor, icone), contas(nome, instituicao)"
    )

    if data_inicio:
        query = query.gte("data", data_inicio)
    if data_fim:
        query = query.lte("data", data_fim)
    if categoria_id:
        query = query.eq("categoria_id", categoria_id)
    if tipo:
        query = query.eq("tipo", tipo.upper())
    if conta_id:
        query = query.eq("conta_id", conta_id)

    offset = (pagina - 1) * limite
    resultado = query.order("data", desc=True).range(offset, offset + limite - 1).execute()
    return resultado.data


@app.get("/transacoes/resumo")
async def resumo_transacoes(_: dict = Depends(usuario_atual)):
    """
    Retorna KPIs: saldo total, receitas e gastos do mês atual e anterior,
    e gastos agrupados por categoria.
    """
    hoje = datetime.utcnow()
    mes_atual_inicio = hoje.replace(day=1).strftime("%Y-%m-%d")

    # Mês anterior
    if hoje.month == 1:
        mes_ant = hoje.replace(year=hoje.year - 1, month=12, day=1)
    else:
        mes_ant = hoje.replace(month=hoje.month - 1, day=1)
    mes_ant_inicio = mes_ant.strftime("%Y-%m-%d")
    mes_ant_fim = hoje.replace(day=1).strftime("%Y-%m-%d")

    def agregar(data_ini: str, data_fim_: str) -> dict:
        res = supabase.table("transacoes").select("tipo, valor").gte("data", data_ini).lt("data", data_fim_).execute()
        receitas = sum(r["valor"] for r in res.data if r["tipo"] == "CREDIT")
        gastos = sum(r["valor"] for r in res.data if r["tipo"] == "DEBIT")
        return {"receitas": receitas, "gastos": gastos}

    atual = agregar(mes_atual_inicio, hoje.strftime("%Y-%m-%d"))
    anterior = agregar(mes_ant_inicio, mes_ant_fim)

    # Saldo total das contas
    contas_res = supabase.table("contas").select("saldo_atual").execute()
    saldo_total = sum(c["saldo_atual"] for c in contas_res.data)

    # Gastos por categoria no mês atual
    cat_res = supabase.table("transacoes").select(
        "categoria_id, valor, categorias(nome, cor, icone)"
    ).eq("tipo", "DEBIT").gte("data", mes_atual_inicio).execute()

    categorias: dict = {}
    for t in cat_res.data:
        cid = t["categoria_id"] or "sem_categoria"
        info = t.get("categorias") or {"nome": "Outros", "cor": "#e05c5c", "icone": "tag"}
        if cid not in categorias:
            categorias[cid] = {"nome": info["nome"], "cor": info["cor"], "icone": info["icone"], "total": 0}
        categorias[cid]["total"] += t["valor"]

    return {
        "saldo_total": saldo_total,
        "mes_atual": atual,
        "mes_anterior": anterior,
        "gastos_por_categoria": list(categorias.values()),
    }


@app.get("/transacoes/evolucao-mensal")
async def evolucao_mensal(_: dict = Depends(usuario_atual), meses: int = Query(6, ge=1, le=24)):
    """Retorna receitas e gastos agrupados por mês para o gráfico de barras."""
    hoje = datetime.utcnow()
    resultado = []

    for i in range(meses - 1, -1, -1):
        if hoje.month - i <= 0:
            m = (hoje.month - i) % 12 + 12
            a = hoje.year - (i - hoje.month) // 12 - 1
        else:
            m = hoje.month - i
            a = hoje.year

        inicio = f"{a}-{m:02d}-01"
        # Fim do mês (aproximado — suficiente para filtros)
        prox_m = m % 12 + 1
        prox_a = a + (1 if m == 12 else 0)
        fim = f"{prox_a}-{prox_m:02d}-01"

        res = supabase.table("transacoes").select("tipo, valor").gte("data", inicio).lt("data", fim).execute()
        receitas = sum(r["valor"] for r in res.data if r["tipo"] == "CREDIT")
        gastos = sum(r["valor"] for r in res.data if r["tipo"] == "DEBIT")
        resultado.append({"mes": f"{a}-{m:02d}", "receitas": receitas, "gastos": gastos})

    return resultado


# ---------------------------------------------------------------------------
# Criar transação manual
# ---------------------------------------------------------------------------
class TransacaoManual(BaseModel):
    descricao: str
    valor: float
    tipo: str          # "CREDIT" ou "DEBIT"
    data: str          # "YYYY-MM-DD"
    categoria_id: Optional[str] = None
    conta_id: Optional[str] = None


@app.post("/transacoes", status_code=status.HTTP_201_CREATED)
async def criar_transacao(dados: TransacaoManual, usuario: dict = Depends(usuario_atual)):
    """Registra uma transação manualmente."""
    if dados.tipo not in ("CREDIT", "DEBIT"):
        raise HTTPException(status_code=400, detail="tipo deve ser CREDIT ou DEBIT")
    if dados.valor <= 0:
        raise HTTPException(status_code=400, detail="valor deve ser positivo")

    inserir = {
        "descricao": dados.descricao,
        "valor": dados.valor,
        "tipo": dados.tipo,
        "data": dados.data,
        "instituicao": "Manual",
    }
    if dados.categoria_id:
        inserir["categoria_id"] = dados.categoria_id
    if dados.conta_id:
        inserir["conta_id"] = dados.conta_id

    resultado = supabase.table("transacoes").insert(inserir).execute()
    return resultado.data[0]


# ---------------------------------------------------------------------------
# Rotas de Categorias
# ---------------------------------------------------------------------------
@app.get("/categorias")
async def listar_categorias(_: dict = Depends(usuario_atual)):
    resultado = supabase.table("categorias").select("*").order("nome").execute()
    return resultado.data


@app.post("/categorias", status_code=status.HTTP_201_CREATED)
async def criar_categoria(dados: dict, _: dict = Depends(usuario_atual)):
    resultado = supabase.table("categorias").insert(dados).execute()
    return resultado.data[0]


# ---------------------------------------------------------------------------
# Webhook de notificações do Bradesco (via MacroDroid)
# ---------------------------------------------------------------------------
class NotificacaoBradesco(BaseModel):
    texto: str          # Texto completo da notificação
    token: str          # Token de segurança para validar a origem


WEBHOOK_TOKEN = os.getenv("WEBHOOK_TOKEN", "bradesco-webhook-secret")


def parsear_notificacao_bradesco(texto: str) -> dict | None:
    """
    Extrai valor, tipo e descrição do texto da notificação do Bradesco.
    Exemplos:
    - "Você enviou um Pix de R$ 4,00 para a conta de João Silva..."
    - "Você recebeu um Pix de R$ 100,00 de Maria Santos..."
    - "Compra no débito de R$ 50,00 em Mercado X"
    """
    import re

    texto_lower = texto.lower()

    # Extrai o valor (R$ X,XX ou R$ X.XXX,XX)
    valor_match = re.search(r'r\$\s*([\d.,]+)', texto_lower)
    if not valor_match:
        return None

    valor_str = valor_match.group(1).replace(".", "").replace(",", ".")
    try:
        valor = float(valor_str)
    except ValueError:
        return None

    # Determina o tipo (CREDIT ou DEBIT)
    palavras_credito = ["recebeu", "recebido", "creditado", "deposito", "entrada"]
    tipo = "DEBIT"
    for p in palavras_credito:
        if p in texto_lower:
            tipo = "CREDIT"
            break

    # Gera descrição limpa
    # Padrão: "Você recebeu um Pix de R$ X de NOME" → "Pix recebido de NOME"
    # Padrão: "Você enviou um Pix de R$ X para a conta de NOME" → "Pix enviado para NOME"
    descricao = texto[:80].strip()

    # Tenta extrair o nome da pessoa
    match_recebeu = re.search(r'pix de r\$[\s\d,.]+de\s+(?:[\d\s]+)?([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇa-záéíóúâêîôûãõç][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇa-záéíóúâêîôûãõç\s]+)', texto, re.IGNORECASE)
    match_enviou  = re.search(r'para a conta de\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇa-záéíóúâêîôûãõç\s]+?)(?:,|na Institui|$)', texto, re.IGNORECASE)
    match_compra  = re.search(r'em\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇa-záéíóúâêîôûãõç\s]+?)(?:\s*$)', texto, re.IGNORECASE)

    if tipo == "CREDIT" and match_recebeu:
        nome = match_recebeu.group(1).strip().title()
        descricao = f"Pix recebido de {nome}"
    elif tipo == "DEBIT" and match_enviou:
        nome = match_enviou.group(1).strip().title()
        descricao = f"Pix enviado para {nome}"
    elif match_compra:
        local = match_compra.group(1).strip().title()
        descricao = f"Compra em {local}"

    return {
        "valor": valor,
        "tipo": tipo,
        "descricao": descricao,
        "instituicao": "Bradesco",
    }


@app.post("/notificacao/bradesco")
async def receber_notificacao_bradesco(request: Request):
    """
    Recebe notificações do Bradesco enviadas pelo MacroDroid.
    Extrai e salva a transação no Supabase.
    """
    # Lê o body bruto para lidar com caracteres especiais
    try:
        body = await request.body()
        import json
        # Tenta UTF-8 primeiro, depois Latin-1 como fallback
        for encoding in ("utf-8", "latin-1", "cp1252"):
            try:
                dados_dict = json.loads(body.decode(encoding))
                break
            except (UnicodeDecodeError, json.JSONDecodeError):
                continue
        else:
            raise ValueError("Não foi possível decodificar o body")
        texto = dados_dict.get("texto", "")
        token = dados_dict.get("token", "")
    except Exception as e:
        logger.error(f"Erro ao parsear body: {e} — body raw: {body[:200]}")
        # Tenta extrair o texto do body bruto como fallback
        texto = body.decode("latin-1", errors="replace")
        token = ""

    # Valida o token de segurança
    if token != WEBHOOK_TOKEN:
        raise HTTPException(status_code=401, detail="Token inválido")

    logger.info(f"Notificação Bradesco recebida: {texto[:100]}")
    transacao = parsear_notificacao_bradesco(texto)
    if not transacao:
        logger.warning(f"Notificação não reconhecida: {texto[:50]}")
        return {"status": "ignorado", "motivo": "Formato não reconhecido"}

    # Busca ou cria a conta Bradesco
    conta = supabase.table("contas").select("id").eq("instituicao", "Bradesco").execute()
    if conta.data:
        conta_id = conta.data[0]["id"]
    else:
        nova_conta = supabase.table("contas").insert({
            "nome": "Conta Bradesco",
            "tipo": "corrente",
            "instituicao": "Bradesco",
            "saldo_atual": 0,
        }).execute()
        conta_id = nova_conta.data[0]["id"]

    # Salva a transação
    supabase.table("transacoes").insert({
        "data": datetime.utcnow().strftime("%Y-%m-%d"),
        "descricao": transacao["descricao"],
        "valor": transacao["valor"],
        "tipo": transacao["tipo"],
        "conta_id": conta_id,
        "instituicao": "Bradesco",
    }).execute()

    logger.info(f"Transação recebida via notificação: {transacao['tipo']} R${transacao['valor']}")
    return {"status": "ok", "transacao": transacao}


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}
