import { neon } from '@neondatabase/serverless';
import { readFile } from 'node:fs/promises';

/**
 * GET /api/migrate
 * Executa migrações pendentes no banco de dados.
 * Deve ser chamado uma vez após deploys que adicionam colunas novas.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    await sql`ALTER TABLE wifi_networks ADD COLUMN IF NOT EXISTS contract VARCHAR(128)`;
    await sql`ALTER TABLE wifi_networks ADD COLUMN IF NOT EXISTS ssid_5g VARCHAR(64) DEFAULT ''`;
    await sql`ALTER TABLE wifi_networks ADD COLUMN IF NOT EXISTS dual_band BOOLEAN NOT NULL DEFAULT TRUE`;
    await sql`ALTER TABLE wifi_networks ADD COLUMN IF NOT EXISTS extra_networks JSONB NOT NULL DEFAULT '[]'::jsonb`;
    const migration = await readFile(new URL('../db/temporary-links.sql', import.meta.url), 'utf8');
    await sql.transaction(migration.split(';').map(s => s.trim()).filter(Boolean).map(s => sql(s)));

    return res.status(200).json({ ok: true, message: 'Migrações aplicadas com sucesso.' });
  } catch (err) {
    console.error('Migration error:', err);
    return res.status(500).json({ error: 'Erro ao executar migração.', detail: err.message });
  }
}
