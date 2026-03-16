import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const { id } = req.query;

    await sql`DELETE FROM wifi_networks WHERE id = ${id}`;

    return res.status(204).end();
  } catch (err) {
    console.error('DELETE /api/networks/[id] error:', err);
    return res.status(500).json({ error: 'Erro ao excluir rede.' });
  }
}
