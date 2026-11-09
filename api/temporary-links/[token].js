import { neon } from '@neondatabase/serverless';
import { tokenHash } from '../../lib/temporary-links.mjs';
import { renderPrintPage } from '../../lib/print-page.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Método não permitido.');
  }
  const token = req.query.token;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(404).send('Link inválido ou expirado. Solicite um novo link.');
  }
  try {
    const sql = neon(process.env.DATABASE_URL);
    const [row] = await sql`
      SELECT payload FROM wifi_print_links
      WHERE token_hash = ${tokenHash(token)} AND expires_at > NOW()
    `;
    if (!row) return res.status(404).send('Link inválido ou expirado. Solicite um novo link.');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(renderPrintPage(row.payload, { temporary: true }));
  } catch (error) {
    console.error('Read temporary print link failed:', error.message);
    return res.status(500).send('Não foi possível carregar a impressão. Tente novamente.');
  }
}
