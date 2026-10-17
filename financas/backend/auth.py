"""
Módulo de autenticação: hash de senha com bcrypt e tokens JWT.
"""

import os
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

load_dotenv()

JWT_SECRET: str = os.environ["JWT_SECRET"]
ALGORITMO = "HS256"
EXPIRACAO_MINUTOS = 60 * 24  # 24 horas

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_senha(senha: str) -> str:
    """Retorna o hash bcrypt da senha."""
    return bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verificar_senha(senha: str, hash_: str) -> bool:
    """Compara a senha em texto puro com o hash armazenado."""
    return bcrypt.checkpw(senha.encode("utf-8"), hash_.encode("utf-8"))


def criar_token(dados: dict, expira_em: Optional[timedelta] = None) -> str:
    """Gera um JWT assinado com o segredo da aplicação."""
    payload = dados.copy()
    expira = datetime.now(timezone.utc) + (expira_em or timedelta(minutes=EXPIRACAO_MINUTOS))
    payload.update({"exp": expira})
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITMO)


def decodificar_token(token: str) -> dict:
    """Decodifica e valida o JWT; lança exceção se inválido."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[ALGORITMO])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def usuario_atual(token: str = Depends(oauth2_scheme)) -> dict:
    """
    Dependência FastAPI: injeta o payload do JWT em cada rota protegida.
    Uso: `usuario: dict = Depends(usuario_atual)`
    """
    payload = decodificar_token(token)
    # Token temporário do 2FA só serve para /auth/verificar-2fa
    if payload.get("totp_pendente") or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


# ---------------------------------------------------------------------------
# Limite de tentativas (em memória — suficiente para um único processo)
# ---------------------------------------------------------------------------
_tentativas: dict[str, list[float]] = {}


def checar_limite(chave: str, maximo: int, janela_segundos: int) -> None:
    """Lança 429 se `chave` já atingiu `maximo` tentativas na janela."""
    agora = time.monotonic()
    recentes = [t for t in _tentativas.get(chave, []) if agora - t < janela_segundos]
    _tentativas[chave] = recentes
    if len(recentes) >= maximo:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas. Aguarde alguns minutos e tente novamente.",
        )


def registrar_tentativa(chave: str) -> None:
    _tentativas.setdefault(chave, []).append(time.monotonic())


def limpar_tentativas(chave: str) -> None:
    _tentativas.pop(chave, None)
