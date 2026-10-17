-- =============================================================================
-- 001 — Separa os dados por usuário
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run.
-- ANTES de rodar, troque SEU_EMAIL@exemplo.com (2 lugares abaixo) pelo
-- e-mail da sua conta no fin.app: os dados que já existem passam a ser seus.
-- =============================================================================

-- 1. Coluna de dono em cada tabela
ALTER TABLE contas     ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE;
ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE;
-- Categorias sem dono (NULL) continuam sendo as categorias padrão, visíveis a todos
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE;

-- 2. Os dados que já existem passam a pertencer à sua conta
UPDATE contas
   SET usuario_id = (SELECT id FROM usuarios WHERE email = 'SEU_EMAIL@exemplo.com')
 WHERE usuario_id IS NULL;

UPDATE transacoes
   SET usuario_id = (SELECT id FROM usuarios WHERE email = 'SEU_EMAIL@exemplo.com')
 WHERE usuario_id IS NULL;

-- 3. Índices para as consultas filtradas por usuário
CREATE INDEX IF NOT EXISTS idx_contas_usuario     ON contas (usuario_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_usuario ON transacoes (usuario_id, data);
CREATE INDEX IF NOT EXISTS idx_categorias_usuario ON categorias (usuario_id);

-- 4. Confira: as duas contagens abaixo devem dar 0.
--    Se não derem, o e-mail do passo 2 estava errado — corrija e rode o passo 2 de novo.
SELECT 'contas sem dono' AS verificacao, count(*) FROM contas WHERE usuario_id IS NULL
UNION ALL
SELECT 'transacoes sem dono', count(*) FROM transacoes WHERE usuario_id IS NULL;
