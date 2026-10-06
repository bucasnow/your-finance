"""
Módulo de conexão com o Supabase (PostgreSQL).
Expõe o cliente `supabase` para ser importado nos demais módulos.
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_KEY: str = os.environ["SUPABASE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ---------------------------------------------------------------------------
# SQL de criação das tabelas (execute uma vez no painel do Supabase)
# ---------------------------------------------------------------------------
SCHEMA_SQL = """
-- Habilita Row Level Security em todas as tabelas
-- Usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    senha_hash  TEXT NOT NULL,
    criado_em   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Categorias
CREATE TABLE IF NOT EXISTS categorias (
    id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome  TEXT NOT NULL,
    cor   TEXT NOT NULL DEFAULT '#888899',
    icone TEXT NOT NULL DEFAULT 'tag'
);
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

-- Contas bancárias
CREATE TABLE IF NOT EXISTS contas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            TEXT NOT NULL,
    tipo            TEXT NOT NULL,           -- corrente, poupança, crédito
    instituicao     TEXT NOT NULL,
    saldo_atual     NUMERIC(15,2) DEFAULT 0,
    pluggy_item_id  TEXT,                    -- ID do item no Pluggy
    ultima_sync     TIMESTAMPTZ,
    usuario_id      UUID REFERENCES usuarios(id) ON DELETE CASCADE
);
ALTER TABLE contas ENABLE ROW LEVEL SECURITY;

-- Transações
CREATE TABLE IF NOT EXISTS transacoes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data         DATE NOT NULL,
    descricao    TEXT NOT NULL,
    valor        NUMERIC(15,2) NOT NULL,
    tipo         TEXT NOT NULL,              -- CREDIT ou DEBIT
    categoria_id UUID REFERENCES categorias(id),
    conta_id     UUID REFERENCES contas(id) ON DELETE CASCADE,
    instituicao  TEXT,
    pluggy_id    TEXT UNIQUE,               -- evita duplicatas
    criado_em    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE transacoes ENABLE ROW LEVEL SECURITY;
"""
