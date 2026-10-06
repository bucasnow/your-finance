"""
Módulo de integração com a Pluggy API (Open Finance Brasil).
Responsável por: autenticação, listagem de itens, contas e transações.
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

PLUGGY_CLIENT_ID: str = os.environ["PLUGGY_CLIENT_ID"]
PLUGGY_CLIENT_SECRET: str = os.environ["PLUGGY_CLIENT_SECRET"]
PLUGGY_BASE_URL = "https://api.pluggy.ai"

# Cache simples do API Key (válido por ~2h na Pluggy)
_api_key_cache: dict = {"key": None, "expires_at": None}


async def obter_api_key() -> str:
    """
    Autentica no Pluggy e retorna o API Key.
    Usa cache em memória para evitar requisições desnecessárias.
    """
    agora = datetime.utcnow()

    if _api_key_cache["key"] and _api_key_cache["expires_at"] > agora:
        return _api_key_cache["key"]

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{PLUGGY_BASE_URL}/auth",
            json={"clientId": PLUGGY_CLIENT_ID, "clientSecret": PLUGGY_CLIENT_SECRET},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

    api_key = data["apiKey"]
    _api_key_cache["key"] = api_key
    # Pluggy API Keys expiram em 2h; renovamos com 10 min de margem
    _api_key_cache["expires_at"] = agora + timedelta(hours=1, minutes=50)

    logger.info("Pluggy API Key renovado com sucesso")
    return api_key


async def _headers() -> dict:
    """Monta os headers de autenticação para as requisições."""
    return {"X-API-KEY": await obter_api_key()}


async def gerar_connect_token() -> str:
    """
    Gera um Connect Token temporário para abrir o Pluggy Connect widget
    no frontend sem expor o CLIENT_SECRET.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{PLUGGY_BASE_URL}/connect_token",
            headers=await _headers(),
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()["accessToken"]


async def listar_itens() -> list[dict]:
    """Retorna todos os itens (conexões bancárias) cadastrados na conta Pluggy."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{PLUGGY_BASE_URL}/items",
            headers=await _headers(),
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json().get("results", [])


async def obter_item(item_id: str) -> dict:
    """Retorna detalhes de um item específico."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{PLUGGY_BASE_URL}/items/{item_id}",
            headers=await _headers(),
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()


async def listar_contas(item_id: str) -> list[dict]:
    """Retorna as contas de um item Pluggy."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{PLUGGY_BASE_URL}/accounts",
            headers=await _headers(),
            params={"itemId": item_id},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json().get("results", [])


async def listar_transacoes(
    conta_id: str,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    pagina: int = 1,
) -> dict:
    """
    Retorna transações de uma conta Pluggy.
    `data_inicio` e `data_fim` no formato 'YYYY-MM-DD'.
    """
    params: dict = {"accountId": conta_id, "page": pagina, "pageSize": 500}
    if data_inicio:
        params["from"] = data_inicio
    if data_fim:
        params["to"] = data_fim

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{PLUGGY_BASE_URL}/transactions",
            headers=await _headers(),
            params=params,
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()


async def todas_transacoes_conta(
    conta_pluggy_id: str,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
) -> list[dict]:
    """Itera todas as páginas de transações de uma conta e retorna a lista completa."""
    transacoes = []
    pagina = 1

    while True:
        dados = await listar_transacoes(conta_pluggy_id, data_inicio, data_fim, pagina)
        resultados = dados.get("results", [])
        transacoes.extend(resultados)

        total_paginas = dados.get("totalPages", 1)
        if pagina >= total_paginas:
            break
        pagina += 1

    return transacoes
