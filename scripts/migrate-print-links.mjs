import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const migration = await readFile(new URL('../db/temporary-links.sql', import.meta.url), 'utf8');
await sql.transaction(migration.split(';').map(s => s.trim()).filter(Boolean).map(s => sql(s)));
console.log('Tabela de links temporários criada.');
