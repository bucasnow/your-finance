"""
Módulo de agendamento: sincroniza transações da Pluggy uma vez por dia via APScheduler.
"""

import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from database import supabase
from pluggy import listar_itens, listar_contas, todas_transacoes_conta

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def sincronizar_transacoes() -> None:
    """
    Puxa transações dos últimos 30 dias de todas as contas conectadas
    e salva no Supabase, ignorando registros já existentes (upsert por pluggy_id).
    """
    inicio = datetime.utcnow()
    logger.info(f"[{inicio:%Y-%m-%d %H:%M:%S}] Iniciando sincronização automática...")

    total_importadas = 0
    total_erros = 0

    try:
        itens = await listar_itens()
        logger.info(f"  Itens encontrados: {len(itens)}")

        data_inicio = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
        data_fim = datetime.utcnow().strftime("%Y-%m-%d")

        for item in itens:
            item_id = item["id"]
            instituicao = item.get("connector", {}).get("name", "Desconhecido")

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
                conta_local = _upsert_conta(conta, item_id, instituicao)
                if not conta_local:
                    continue

                try:
                    transacoes = await todas_transacoes_conta(conta_pluggy_id, data_inicio, data_fim)
                except Exception as e:
                    logger.error(f"  Erro ao buscar transações da conta {conta_pluggy_id}: {e}")
                    total_erros += 1
                    continue

                importadas = _salvar_transacoes(transacoes, conta_local["id"], instituicao)
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


def _upsert_conta(conta_pluggy: dict, item_id: str, instituicao: str) -> dict | None:
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
                },
                on_conflict="pluggy_item_id",
            )
            .execute()
        )
        return resultado.data[0] if resultado.data else None
    except Exception as e:
        logger.error(f"Erro ao upsert conta: {e}")
        return None


def _salvar_transacoes(transacoes: list[dict], conta_id: str, instituicao: str) -> int:
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
