import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql    = neon(process.env.DATABASE_URL);
  const { id } = req.query;

  /* ── DELETE: excluir ── */
  if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM wifi_networks WHERE id = ${id}`;
      return res.status(204).end();
    } catch (err) {
      console.error('DELETE /api/networks/[id] error:', err);
      return res.status(500).json({ error: 'Erro ao excluir rede.' });
    }
  }

  /* ── PUT: editar ── */
  if (req.method === 'PUT') {
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
        UPDATE wifi_networks SET
          ssid               = ${ssid.trim()},
          password           = ${password || ''},
          security           = ${security},
          hidden             = ${!!hidden},
          eap_method         = ${eapMethod || null},
          identity           = ${identity || null},
          eap_password       = ${eapPassword || null},
          phase2             = ${phase2 || null},
          anonymous_identity = ${anonymousIdentity || null},
          contract           = ${contract || null}
        WHERE id = ${id}
        RETURNING id, created_at
      `;

      if (!row) return res.status(404).json({ error: 'Registro não encontrado.' });

      return res.status(200).json({
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
      console.error('PUT /api/networks/[id] error:', err);
      return res.status(500).json({ error: 'Erro ao editar rede.' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}
