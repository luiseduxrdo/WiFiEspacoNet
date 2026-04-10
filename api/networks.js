import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  /* ── GET: listar histórico ── */
  if (req.method === 'GET') {
    try {
      const since  = req.query.since || '1970-01-01T00:00:00Z';
      const limit  = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const search = req.query.search ? `%${req.query.search}%` : null;

      const rows = search
        ? await sql`
            SELECT id, ssid, password, security, hidden,
                   eap_method, identity, eap_password, phase2, anonymous_identity,
                   contract, created_at
            FROM wifi_networks
            WHERE created_at > ${since}
              AND (ssid ILIKE ${search} OR contract ILIKE ${search})
            ORDER BY created_at DESC
            LIMIT ${limit}
          `
        : await sql`
            SELECT id, ssid, password, security, hidden,
                   eap_method, identity, eap_password, phase2, anonymous_identity,
                   contract, created_at
            FROM wifi_networks
            WHERE created_at > ${since}
            ORDER BY created_at DESC
            LIMIT ${limit}
          `;

      const networks = rows.map(r => ({
        id:                r.id,
        ssid:              r.ssid,
        password:          r.password,
        security:          r.security,
        hidden:            r.hidden,
        eapMethod:         r.eap_method,
        identity:          r.identity,
        eapPassword:       r.eap_password,
        phase2:            r.phase2,
        anonymousIdentity: r.anonymous_identity,
        contract:          r.contract,
        createdAt:         r.created_at,
      }));

      return res.status(200).json({ networks });
    } catch (err) {
      console.error('GET /api/networks error:', err);
      return res.status(500).json({ error: 'Erro ao buscar histórico.' });
    }
  }

  /* ── POST: salvar novo Wi-Fi ── */
  if (req.method === 'POST') {
    try {
      const {
        ssid, password, security, hidden,
        eapMethod, identity, eapPassword, phase2, anonymousIdentity,
        contract,
      } = req.body;

      /* Validação */
      const errors = [];
      if (!ssid || !ssid.trim())
        errors.push('SSID é obrigatório.');
      if (!['WPA', 'WEP', 'nopass', 'WPA2-EAP'].includes(security))
        errors.push('Tipo de segurança inválido.');
      if (security !== 'nopass' && security !== 'WPA2-EAP' && !password)
        errors.push('Senha é obrigatória.');
      else if (security !== 'nopass' && security !== 'WPA2-EAP' && password.length < 8)
        errors.push('Senha deve ter no mínimo 8 caracteres.');
      if (security === 'WPA2-EAP') {
        if (!identity || !identity.trim())
          errors.push('Identity é obrigatório para Enterprise.');
        if (!eapPassword)
          errors.push('Password Enterprise é obrigatório.');
      }
      if (errors.length)
        return res.status(400).json({ errors });

      const [row] = await sql`
        INSERT INTO wifi_networks
          (ssid, password, security, hidden, eap_method, identity, eap_password, phase2, anonymous_identity, contract)
        VALUES
          (${ssid.trim()}, ${password || ''}, ${security}, ${!!hidden},
           ${eapMethod || null}, ${identity || null}, ${eapPassword || null},
           ${phase2 || null}, ${anonymousIdentity || null}, ${contract || null})
        RETURNING id, created_at
      `;

      return res.status(201).json({
        id:                row.id,
        ssid:              ssid.trim(),
        password:          password || '',
        security,
        hidden:            !!hidden,
        eapMethod:         eapMethod || null,
        identity:          identity || null,
        eapPassword:       eapPassword || null,
        phase2:            phase2 || null,
        anonymousIdentity: anonymousIdentity || null,
        contract:          contract || null,
        createdAt:         row.created_at,
      });
    } catch (err) {
      console.error('POST /api/networks error:', err);
      return res.status(500).json({ error: 'Erro ao salvar rede.' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}
