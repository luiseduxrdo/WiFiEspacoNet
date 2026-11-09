import { neon } from '@neondatabase/serverless';
import { newToken, tokenHash, validatePrintPayload } from '../lib/temporary-links.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  if (!validatePrintPayload(req.body)) {
    return res.status(400).json({ error: 'Dados de impressão inválidos ou muito grandes. Gere os cartões novamente.' });
  }
  try {
    const sql = neon(process.env.DATABASE_URL);
    const token = newToken();
    const { dataUrls, pw, ph, rotated, copies } = req.body;
    const [row] = await sql`
      INSERT INTO wifi_print_links (token_hash, payload)
      VALUES (${tokenHash(token)}, ${JSON.stringify({ dataUrls, pw, ph, rotated, copies })}::jsonb)
      RETURNING expires_at
    `;
    return res.status(201).json({ path: `/api/temporary-links/${token}`, expiresAt: row.expires_at });
  } catch (error) {
    console.error('Create temporary print link failed:', error.message);
    return res.status(500).json({ error: 'Não foi possível criar o link temporário. Tente novamente.' });
  }
}
