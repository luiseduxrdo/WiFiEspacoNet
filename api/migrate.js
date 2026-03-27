import { neon } from '@neondatabase/serverless';

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

    return res.status(200).json({ ok: true, message: 'Migrações aplicadas com sucesso.' });
  } catch (err) {
    console.error('Migration error:', err);
    return res.status(500).json({ error: 'Erro ao executar migração.', detail: err.message });
  }
}
