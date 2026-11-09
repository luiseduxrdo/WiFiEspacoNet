import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const rows = await sql`DELETE FROM wifi_print_links WHERE expires_at <= NOW() RETURNING token_hash`;
console.log(`Links temporários expirados excluídos: ${rows.length}`);
