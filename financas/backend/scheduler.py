"""
Módulo de agendamento: sincroniza transações da Pluggy uma vez por dia via APScheduler.
"""

import logging
import os
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from database import supabase
from pluggy import listar_itens, listar_contas, todas_transacoes_conta

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def _id_dono_padrao() -> str | None:
    """Usuário dono das conexões criadas antes do vínculo por clientUserId."""
    email = os.getenv("DONO_EMAIL", "").strip().lower()
    if not email:
        return None
    res = supabase.table("usuarios").select("id").eq("email", email).execute()
    return res.data[0]["id"] if res.data else None


async def sincronizar_transacoes(usuario_id: str | None = None) -> None:
    """
    Puxa transações dos últimos 30 dias das contas conectadas e salva no
    Supabase, ignorando registros já existentes (upsert por pluggy_id).
    Com `usuario_id`, sincroniza apenas as conexões desse usuário.
    """
    inicio = datetime.utcnow()
    logger.info(f"[{inicio:%Y-%m-%d %H:%M:%S}] Iniciando sincronização automática...")

    total_importadas = 0
    total_erros = 0

    try:
        itens = await listar_itens()
        logger.info(f"  Itens encontrados: {len(itens)}")
        dono_padrao = _id_dono_padrao()

        data_inicio = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
        data_fim = datetime.utcnow().strftime("%Y-%m-%d")

        for item in itens:
            item_id = item["id"]
            instituicao = item.get("connector", {}).get("name", "Desconhecido")

            dono = item.get("clientUserId") or dono_padrao
            if not dono:
                logger.warning(f"  Item {item_id} sem dono identificado — ignorado")
                continue
            if usuario_id and dono != usuario_id:
                continue

            try:
                contas = await listar_contas(item_id)
            except Exception as e:
                logger.error(f"  Erro ao listar contas do item {item_id}: {e}")
                total_erros += 1
                continue

            for conta in contas:
                conta_pluggy_id = conta["id"]
                conta_nome = conta.get("name", "Conta")

                # Garante que a conta existe no Supabase
                conta_local = _upsert_conta(conta, item_id, instituicao, dono)
                if not conta_local:
                    continue

                try:
                    transacoes = await todas_transacoes_conta(conta_pluggy_id, data_inicio, data_fim)
                except Exception as e:
                    logger.error(f"  Erro ao buscar transações da conta {conta_pluggy_id}: {e}")
                    total_erros += 1
                    continue

                importadas = _salvar_transacoes(transacoes, conta_local["id"], instituicao, dono)
                total_importadas += importadas

                # Atualiza saldo e data de sincronização da conta
                supabase.table("contas").update({
                    "saldo_atual": conta.get("balance", 0),
                    "ultima_sync": datetime.utcnow().isoformat(),
                }).eq("id", conta_local["id"]).execute()

                logger.info(f"    {instituicao} / {conta_nome}: {importadas} transações importadas")

    except Exception as e:
        logger.error(f"Erro geral na sincronização: {e}")
        total_erros += 1

    duracao = (datetime.utcnow() - inicio).seconds
    logger.info(
        f"[{datetime.utcnow():%Y-%m-%d %H:%M:%S}] Sincronização concluída em {duracao}s — "
        f"{total_importadas} importadas, {total_erros} erros"
    )


def _upsert_conta(conta_pluggy: dict, item_id: str, instituicao: str, usuario_id: str) -> dict | None:
    """
    Insere ou atualiza uma conta no Supabase.
    Retorna o registro local da conta ou None em caso de erro.
    """
    try:
        resultado = (
            supabase.table("contas")
            .upsert(
                {
                    "pluggy_item_id": item_id,
                    "nome": conta_pluggy.get("name", "Conta"),
                    "tipo": conta_pluggy.get("type", "CHECKING").lower(),
                    "instituicao": instituicao,
                    "saldo_atual": conta_pluggy.get("balance", 0),
                    "usuario_id": usuario_id,
                },
                on_conflict="pluggy_item_id",
            )
            .execute()
        )
        return resultado.data[0] if resultado.data else None
    except Exception as e:
        logger.error(f"Erro ao upsert conta: {e}")
        return None


def _salvar_transacoes(transacoes: list[dict], conta_id: str, instituicao: str, usuario_id: str) -> int:
    """
    Salva uma lista de transações no Supabase.
    Usa `pluggy_id` como chave única para evitar duplicatas.
    Retorna o número de registros efetivamente inseridos.
    """
    if not transacoes:
        return 0

    registros = []
    for t in transacoes:
        registros.append({
            "pluggy_id": t["id"],
            "data": t.get("date", "")[:10],   # YYYY-MM-DD
            "descricao": t.get("description", ""),
            "valor": abs(float(t.get("amount", 0))),
            "tipo": t.get("type", "DEBIT"),    # CREDIT ou DEBIT
            "conta_id": conta_id,
            "instituicao": instituicao,
            "usuario_id": usuario_id,
        })

    try:
        resultado = (
            supabase.table("transacoes")
            .upsert(registros, on_conflict="pluggy_id", ignore_duplicates=True)
            .execute()
        )
        return len(resultado.data) if resultado.data else 0
    except Exception as e:
        logger.error(f"Erro ao salvar transações: {e}")
        return 0


def iniciar_scheduler() -> None:
    """Registra o job diário e inicia o scheduler."""
    scheduler.add_job(
        sincronizar_transacoes,
        trigger=CronTrigger(hour=4, minute=0),  # toda madrugada às 04:00 UTC
        id="sync_diaria",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()
    logger.info("Scheduler iniciado — sync diária às 04:00 UTC")
