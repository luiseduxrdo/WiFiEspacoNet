import { neon } from '@neondatabase/serverless';

const MAX_NETWORKS_PER_RECORD = 4;

function normalizeExtraNetworks(extraNetworks, security) {
  if (!Array.isArray(extraNetworks)) return [];
  return extraNetworks
    .map(n => ({
      ssid: String((n && n.ssid) || '').trim(),
      password: security === 'nopass' ? '' : String((n && n.password) || ''),
    }))
    .slice(0, MAX_NETWORKS_PER_RECORD - 1);
}

function validatePayload(body) {
  const {
    ssid, password, security, dualBand = true, ssid5g,
    identity, eapPassword, extraNetworks,
  } = body;
  const errors = [];
  const extras = normalizeExtraNetworks(extraNetworks, security);
  const networkCount = 1 + extras.length;

  if (!ssid || !ssid.trim())
    errors.push('SSID e obrigatorio.');
  if (!['WPA', 'WEP', 'nopass', 'WPA2-EAP'].includes(security))
    errors.push('Tipo de seguranca invalido.');
  if (dualBand === false && (!ssid5g || !ssid5g.trim()))
    errors.push('SSID 5 GHz e obrigatorio.');
  if (security !== 'nopass' && security !== 'WPA2-EAP' && !password)
    errors.push('Senha e obrigatoria.');
  else if (security !== 'nopass' && security !== 'WPA2-EAP' && password.length < 8)
    errors.push('Senha deve ter no minimo 8 caracteres.');
  if (security === 'WPA2-EAP') {
    if (!identity || !identity.trim())
      errors.push('Identity e obrigatorio para Enterprise.');
    if (!eapPassword)
      errors.push('Password Enterprise e obrigatorio.');
    if (extras.length)
      errors.push('Redes adicionais nao estao disponiveis para WPA2-EAP.');
  }
  if (networkCount > MAX_NETWORKS_PER_RECORD)
    errors.push(`Limite de ${MAX_NETWORKS_PER_RECORD} redes por cadastro.`);
  if (security !== 'WPA2-EAP') {
    extras.forEach((network, index) => {
      if (!network.ssid)
        errors.push(`SSID da rede adicional ${index + 1} e obrigatorio.`);
      if (security !== 'nopass' && !network.password)
        errors.push(`Senha da rede adicional ${index + 1} e obrigatoria.`);
      else if (security !== 'nopass' && network.password.length < 8)
        errors.push(`Senha da rede adicional ${index + 1} deve ter no minimo 8 caracteres.`);
    });
  }

  return { errors, extras };
}

function mapRow(r) {
  return {
    id:                r.id,
    ssid:              r.ssid,
    ssid5g:            r.ssid_5g || '',
    dualBand:          r.dual_band !== false,
    password:          r.password,
    security:          r.security,
    hidden:            r.hidden,
    eapMethod:         r.eap_method,
    identity:          r.identity,
    eapPassword:       r.eap_password,
    phase2:            r.phase2,
    anonymousIdentity: r.anonymous_identity,
    contract:          r.contract,
    extraNetworks:     Array.isArray(r.extra_networks) ? r.extra_networks : [],
    createdAt:         r.created_at,
  };
}

export default async function handler(req, res) {
  const sql    = neon(process.env.DATABASE_URL);
  const { id } = req.query;

  if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM wifi_networks WHERE id = ${id}`;
      return res.status(204).end();
    } catch (err) {
      console.error('DELETE /api/networks/[id] error:', err);
      return res.status(500).json({ error: 'Erro ao excluir rede.' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const {
        ssid, ssid5g, dualBand = true, password, security, hidden,
        eapMethod, identity, eapPassword, phase2, anonymousIdentity,
        contract,
      } = req.body;
      const { errors, extras } = validatePayload(req.body);
      if (errors.length) return res.status(400).json({ errors });

      const [row] = await sql`
        UPDATE wifi_networks SET
          ssid               = ${ssid.trim()},
          ssid_5g            = ${ssid5g ? ssid5g.trim() : ''},
          dual_band          = ${dualBand !== false},
          password           = ${password || ''},
          security           = ${security},
          hidden             = ${!!hidden},
          eap_method         = ${eapMethod || null},
          identity           = ${identity || null},
          eap_password       = ${eapPassword || null},
          phase2             = ${phase2 || null},
          anonymous_identity = ${anonymousIdentity || null},
          contract           = ${contract || null},
          extra_networks     = CAST(${JSON.stringify(extras)} AS jsonb)
        WHERE id = ${id}
        RETURNING id, ssid, ssid_5g, dual_band, password, security, hidden,
                  eap_method, identity, eap_password, phase2, anonymous_identity,
                  contract, extra_networks, created_at
      `;

      if (!row) return res.status(404).json({ error: 'Registro nao encontrado.' });

      return res.status(200).json(mapRow(row));
    } catch (err) {
      console.error('PUT /api/networks/[id] error:', err);
      return res.status(500).json({ error: 'Erro ao editar rede.' });
    }
  }

  return res.status(405).json({ error: 'Metodo nao permitido.' });
}
