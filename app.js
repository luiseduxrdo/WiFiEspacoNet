'use strict';

/* ══════════════════════════════════════════════════════════════════════════
   CONFIGURAÇÃO DE LAYOUT (unidades lógicas — pixels em escala 1x)
   ══════════════════════════════════════════════════════════════════════════ */
const CFG = {
  /* QR code */
  QR_SIZE: 360,           // tamanho do módulo QR (sem margens externas)
  QR_BORDER_GAP_RATIO: 0.015, // afastamento proporcional ao tamanho do QR
  QR_BORDER_GAP_MIN: 4,    // afastamento mínimo em px (escala 1x)
  QR_BORDER_WIDTH: 5,      // espessura da borda decorativa
  QR_BORDER_RADIUS: 3,    // raio de canto da borda decorativa

  /* Card Wi-Fi */
  CARD_W:    440,
  CARD_H:    216,
  HEADER_H:  76,          // altura da faixa superior do card
  LABEL_W:   112,         // largura da coluna de rótulos
  RADIUS:    10,          // raio de borda do card

  /* Combo (QR + card) */
  MARGIN:    34,          // margem externa do combo
  QR_CARD_GAP: 22,        // espaço entre QR e card

  /* Exportação */
  SCALE_NORMAL: 3,
  SCALE_HIGH:   4,
};

/* Escala de fonte do texto do card (rótulos e valores). */
const CARD_TEXT_SCALE = 2;
const MAX_NETWORKS_PER_RECORD = 4;
const QR_PAIR_GAP = 28;
const QR_LABEL_H = 22;
const QR_LABEL_GAP = 8;

/* Derivados */
CFG.ROW_H      = (CFG.CARD_H - CFG.HEADER_H) / 2;        // altura de cada linha da tabela (2 linhas)
CFG.CARD_H_3ROW = CFG.HEADER_H + CFG.ROW_H * 3;          // altura do card com 3 linhas (dual band off)
CFG.COMBO_W = Math.max(CFG.QR_SIZE, CFG.CARD_W) + CFG.MARGIN * 2;
CFG.COMBO_H = CFG.MARGIN + CFG.QR_SIZE + CFG.QR_CARD_GAP + CFG.CARD_H + CFG.MARGIN;

/* ══════════════════════════════════════════════════════════════════════════
   ESTADO DO FORMULÁRIO
   ══════════════════════════════════════════════════════════════════════════ */
const state = {
  ssid:            '',
  ssid5g:          '',
  dualBand:        true,
  password:        '',
  securityType:    'WPA',
  hidden:          false,
  eapMethod:       'PEAP',
  identity:        '',
  eapPassword:     '',
  phase2:          '',
  anonymousIdentity: '',
  contract:        '',
  extraNetworks:   [],
};

/* ID do registro sendo editado (null = criando novo) */
let editingId = null;

/* ══════════════════════════════════════════════════════════════════════════
   CARREGAMENTO DE IMAGENS
   ══════════════════════════════════════════════════════════════════════════ */
const imgs = { logo: null, wifi: null };

function loadImg(key, src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload  = () => { imgs[key] = img; resolve(); };
    img.onerror = () => resolve();       // falha silenciosa — card ainda renderiza
    img.src = src;
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   GERAÇÃO DE PAYLOAD Wi-Fi QR (padrão ZXing)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Escapa caracteres especiais do padrão Wi-Fi QR:
 *   \ ; , " :  →  precedidos de \
 */
function escWifi(str) {
  return String(str).replace(/[\\;,":]/g, ch => '\\' + ch);
}

function buildPayload(s) {
  const ssid   = escWifi(s.ssid);
  const hidden = s.hidden ? 'true' : 'false';

  if (s.securityType === 'WPA2-EAP') {
    let p = `WIFI:T:WPA2-EAP;S:${ssid};`;
    p += `E:${s.eapMethod};`;
    p += `I:${escWifi(s.identity)};`;
    p += `P:${escWifi(s.eapPassword)};`;
    if (s.phase2)           p += `PH2:${escWifi(s.phase2)};`;
    if (s.anonymousIdentity) p += `A:${escWifi(s.anonymousIdentity)};`;
    p += `H:${hidden};;`;
    return p;
  }

  if (s.securityType === 'nopass') {
    return `WIFI:T:nopass;S:${ssid};H:${hidden};;`;
  }

  const type = s.securityType === 'WEP' ? 'WEP' : 'WPA';
  return `WIFI:T:${type};S:${ssid};P:${escWifi(s.password)};H:${hidden};;`;
}

function normalizeExtraNetworks(extraNetworks) {
  if (!Array.isArray(extraNetworks)) return [];
  return extraNetworks
    .map(n => ({
      ssid: String((n && n.ssid) || ''),
      password: String((n && n.password) || ''),
    }))
    .slice(0, MAX_NETWORKS_PER_RECORD - 1);
}

function getBaseNetworkPassword(s) {
  return s.securityType === 'nopass' ? '' : s.password;
}

function getNetworkSlotsUsed(s) {
  return 1 + normalizeExtraNetworks(s.extraNetworks).length;
}

function getRenderableNetworks(s) {
  const networks = [{
    ssid: String(s.ssid || '').trim(),
    password: getBaseNetworkPassword(s),
    ssid5g: s.dualBand ? null : String(s.ssid5g || '').trim(),
  }];

  if (s.securityType !== 'WPA2-EAP') {
    normalizeExtraNetworks(s.extraNetworks).forEach(n => {
      networks.push({
        ssid: n.ssid.trim(),
        password: s.securityType === 'nopass' ? '' : n.password,
        ssid5g: null,
      });
    });
  }

  return networks.slice(0, MAX_NETWORKS_PER_RECORD);
}

function buildNetworkPayload(network) {
  return buildPayload({
    ...state,
    ssid: network.ssid,
    password: network.password,
  });
}

function getNetworkQrEntries(network) {
  const entries = [{ label: network.ssid5g ? '2.4 GHz' : '', ssid: network.ssid, password: network.password }];
  if (network.ssid5g) {
    entries.push({ label: '5 GHz', ssid: network.ssid5g, password: network.password });
  }
  return entries;
}

/* ══════════════════════════════════════════════════════════════════════════
   VALIDAÇÃO
   ══════════════════════════════════════════════════════════════════════════ */
function validate(s) {
  const err = {};
  const extras = normalizeExtraNetworks(s.extraNetworks);
  if (!s.ssid.trim())                                    err.ssid     = 'SSID é obrigatório.';
  if (!s.dualBand && !s.ssid5g.trim())                   err.ssid5g   = 'SSID 5 GHz é obrigatório.';
  if (s.securityType !== 'nopass' && s.securityType !== 'WPA2-EAP' && !s.password)
                                                          err.password = 'Senha é obrigatória.';
  else if (s.securityType !== 'nopass' && s.securityType !== 'WPA2-EAP' && s.password.length < 8)
                                                          err.password = 'Senha deve ter no mínimo 8 caracteres.';
  if (s.securityType === 'WPA2-EAP') {
    if (!s.identity.trim())                              err.identity    = 'Identity é obrigatório.';
    if (!s.eapPassword)                                  err.eapPassword = 'Password é obrigatório.';
  }
  if (s.securityType === 'WPA2-EAP' && extras.length) {
    err.extraNetworks = 'Redes adicionais nao estao disponiveis para WPA2-EAP.';
  }
  if (getNetworkSlotsUsed(s) > MAX_NETWORKS_PER_RECORD) {
    err.extraNetworks = `Limite de ${MAX_NETWORKS_PER_RECORD} redes por cadastro.`;
  }
  if (s.securityType !== 'WPA2-EAP') {
    extras.forEach((network, index) => {
      if (!network.ssid.trim()) {
        err[`extraNetworkSsid${index}`] = 'SSID e obrigatorio.';
      }
      if (s.securityType !== 'nopass' && !network.password) {
        err[`extraNetworkPassword${index}`] = 'Senha e obrigatoria.';
      } else if (s.securityType !== 'nopass' && network.password.length < 8) {
        err[`extraNetworkPassword${index}`] = 'Senha deve ter no minimo 8 caracteres.';
      }
    });
  }
  return err;
}

/* ══════════════════════════════════════════════════════════════════════════
   RENDERIZAÇÃO DE TEXTO COM AUTO-FIT
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Desenha `text` dentro de uma caixa, ajustando o tamanho de fonte
 * de maxPx até minPx. Se ainda não couber, quebra em 2 linhas ou trunca.
 */
function drawFittedText(ctx, text, boxX, boxY, boxW, boxH, maxPx, minPx, font) {
  if (!text) return;

  const PAD  = Math.round(boxW * 0.025) + 5;  // padding lateral interno
  const availW = boxW - PAD * 2;
  const midY   = boxY + boxH / 2;

  ctx.textBaseline = 'middle';
  ctx.textAlign    = 'left';
  ctx.fillStyle    = '#111';

  /* 1. Tenta caber em 1 linha reduzindo a fonte */
  let fz = maxPx;
  ctx.font = `${fz}px ${font}`;
  while (fz > minPx && ctx.measureText(text).width > availW) {
    fz -= 0.5;
    ctx.font = `${fz}px ${font}`;
  }

  if (ctx.measureText(text).width <= availW) {
    ctx.fillText(text, boxX + PAD, midY);
    return;
  }

  /* 2. Na fonte mínima, tenta 2 linhas */
  ctx.font = `${minPx}px ${font}`;
  const lineH = minPx * 1.35;

  // Encontra ponto de divisão: máx chars que cabem na 1ª linha
  let splitAt = 1;
  for (let i = 1; i <= text.length; i++) {
    if (ctx.measureText(text.substring(0, i)).width <= availW) splitAt = i;
    else break;
  }

  const line1 = text.substring(0, splitAt);
  const line2 = text.substring(splitAt);

  if (ctx.measureText(line2).width <= availW) {
    // Ambas as linhas cabem
    ctx.fillText(line1, boxX + PAD, midY - lineH / 2);
    ctx.fillText(line2, boxX + PAD, midY + lineH / 2);
  } else {
    // Trunca linha 2 com ellipsis
    let t2 = line2;
    while (t2.length > 0 && ctx.measureText(t2 + '\u2026').width > availW) {
      t2 = t2.slice(0, -1);
    }
    ctx.fillText(line1, boxX + PAD, midY - lineH / 2);
    ctx.fillText(t2 + '\u2026', boxX + PAD, midY + lineH / 2);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   HELPER: roundRect path
   ══════════════════════════════════════════════════════════════════════════ */
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

/* ══════════════════════════════════════════════════════════════════════════
   GERAÇÃO DO QR CODE (canvas)
   ══════════════════════════════════════════════════════════════════════════ */
function makeQRCanvas(payload, size) {
  try {
    const qr = qrcode(0, 'M');        // tipo=0 (auto), ECC=M (bom para impressão)
    qr.addData(payload, 'Byte');       // modo Byte suporta UTF-8 completo
    qr.make();

    const mods     = qr.getModuleCount();
    const modPx    = Math.floor(size / (mods + 8));  // 4 módulos de quiet zone cada lado
    const quietPx  = Math.floor((size - mods * modPx) / 2);

    const c   = document.createElement('canvas');
    c.width   = size;
    c.height  = size;
    const ctx = c.getContext('2d');

    /* Fundo branco (inclui quiet zone) */
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    /* Módulos escuros */
    ctx.fillStyle = '#000000';
    for (let row = 0; row < mods; row++) {
      for (let col = 0; col < mods; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect(
            quietPx + col * modPx,
            quietPx + row * modPx,
            modPx, modPx
          );
        }
      }
    }
    return c;
  } catch (e) {
    console.error('QR generation error:', e);
    return null;
  }
}

function drawQRBorder(ctx, x, y, size, s) {
  const gap    = Math.max(CFG.QR_BORDER_GAP_MIN * s, size * CFG.QR_BORDER_GAP_RATIO);
  const lineW  = CFG.QR_BORDER_WIDTH * s;
  const radius = CFG.QR_BORDER_RADIUS * s;

  const bX = x - gap;
  const bY = y - gap;
  const bS = size + (gap * 2);

  const grad = ctx.createLinearGradient(bX, bY, bX + bS, bY + bS);
  grad.addColorStop(0, '#7AB517');
  grad.addColorStop(1, '#E07B00');

  ctx.save();
  ctx.strokeStyle = grad;
  ctx.lineWidth   = lineW;
  ctx.lineJoin    = 'round';
  roundRectPath(ctx, bX, bY, bS, bS, radius);
  ctx.stroke();
  ctx.restore();
}

/* ══════════════════════════════════════════════════════════════════════════
   RENDERIZAÇÃO DO CARD
   ══════════════════════════════════════════════════════════════════════════ */
function renderCard(ctx, x, y, ssid, password, s, ssid5g) {
  const isDual   = ssid5g != null;
  const rowCount = isDual ? 3 : 2;
  const W  = CFG.CARD_W  * s;
  const H  = (isDual ? CFG.CARD_H_3ROW : CFG.CARD_H) * s;
  const hH = CFG.HEADER_H * s;
  const lW = CFG.LABEL_W  * s;
  const rH = CFG.ROW_H    * s;
  const r  = CFG.RADIUS   * s;

  const lw = 1.5 * s;      // espessura das linhas internas

  /* ── Sombra sutil */
  ctx.save();
  ctx.shadowColor   = 'rgba(0,0,0,0.14)';
  ctx.shadowBlur    = 8 * s;
  ctx.shadowOffsetY = 2 * s;
  ctx.fillStyle = '#fff';
  roundRectPath(ctx, x, y, W, H, r);
  ctx.fill();
  ctx.restore();

  /* ── Borda externa */
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth   = 2 * s;
  roundRectPath(ctx, x, y, W, H, r);
  ctx.stroke();

  /* ── Área do cabeçalho (clip para respeitar bordas arredondadas) */
  ctx.save();
  roundRectPath(ctx, x, y, W, H, r);
  ctx.clip();

  ctx.fillStyle = '#f7f7f7';
  ctx.fillRect(x, y, W, hH);

  /* Linha divisória cabeçalho / tabela */
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth   = lw;
  ctx.beginPath();
  ctx.moveTo(x,     y + hH);
  ctx.lineTo(x + W, y + hH);
  ctx.stroke();

  /* ── Coluna de rótulos (fundo levemente cinza) */
  ctx.fillStyle = '#efefef';
  ctx.fillRect(x, y + hH, lW, H - hH);

  /* Linha vertical rótulo | valor */
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth   = lw;
  ctx.beginPath();
  ctx.moveTo(x + lW, y + hH);
  ctx.lineTo(x + lW, y + H);
  ctx.stroke();

  /* Linhas separadoras entre linhas da tabela */
  for (let i = 1; i < rowCount; i++) {
    ctx.beginPath();
    ctx.moveTo(x,     y + hH + rH * i);
    ctx.lineTo(x + W, y + hH + rH * i);
    ctx.stroke();
  }

  ctx.restore();  // fim do clip

  /* ── Ícone WiFi (esquerda do cabeçalho) */
  if (imgs.wifi) {
    const iH  = 54 * s;
    const iW  = iH * 1.38; // leve ganho extra de largura
    const iX  = x + 14 * s;
    const iY  = y + (hH - iH) / 2;
    ctx.drawImage(imgs.wifi, iX, iY, iW, iH);
  }

  /* ── Logo EspaçoNet (direita do cabeçalho) */
  if (imgs.logo) {
    const maxW  = 148 * s;
    const maxH  = 52 * s;
    const ratio = imgs.logo.width / imgs.logo.height;
    let lw2 = maxW, lh = lw2 / ratio;
    if (lh > maxH) { lh = maxH; lw2 = lh * ratio; }
    const lX = x + W - lw2 - 14 * s;
    const lY = y + (hH - lh) / 2;
    ctx.drawImage(imgs.logo, lX, lY, lw2, lh);
  }

  /* ── Rótulos */
  ctx.fillStyle    = '#333';
  ctx.font         = `bold ${13 * CARD_TEXT_SCALE * s}px Arial, sans-serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  if (isDual) {
    ctx.fillText('2.4 GHz', x + lW / 2, y + hH + rH * 0.5);
    ctx.fillText('5 GHz',   x + lW / 2, y + hH + rH * 1.5);
    ctx.fillText('Senha',   x + lW / 2, y + hH + rH * 2.5);
  } else {
    ctx.fillText('Nome',  x + lW / 2, y + hH + rH / 2);
    ctx.fillText('Senha', x + lW / 2, y + hH + rH + rH / 2);
  }

  /* ── Valores */
  const monoFont = `'Arial Black', 'Arial Bold', Arial, sans-serif`;
  if (isDual) {
    drawFittedText(ctx, ssid,     x + lW, y + hH,        W - lW, rH, 14 * CARD_TEXT_SCALE * s, 8.5 * CARD_TEXT_SCALE * s, monoFont);
    drawFittedText(ctx, ssid5g,   x + lW, y + hH + rH,   W - lW, rH, 14 * CARD_TEXT_SCALE * s, 8.5 * CARD_TEXT_SCALE * s, monoFont);
    drawFittedText(ctx, password, x + lW, y + hH + rH*2, W - lW, rH, 14 * CARD_TEXT_SCALE * s, 8.5 * CARD_TEXT_SCALE * s, monoFont);
  } else {
    drawFittedText(ctx, ssid,     x + lW, y + hH,      W - lW, rH, 14 * CARD_TEXT_SCALE * s, 8.5 * CARD_TEXT_SCALE * s, monoFont);
    drawFittedText(ctx, password, x + lW, y + hH + rH, W - lW, rH, 14 * CARD_TEXT_SCALE * s, 8.5 * CARD_TEXT_SCALE * s, monoFont);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   RENDERIZAÇÃO DO COMBO (QR + card)
   ══════════════════════════════════════════════════════════════════════════ */
function getGridMetrics(kind, scale) {
  const networks = getRenderableNetworks(state);
  const hasDualQr = networks.some(n => n.ssid5g);
  const maxCardH = networks.some(n => n.ssid5g) ? CFG.CARD_H_3ROW : CFG.CARD_H;
  const qrBlockW = hasDualQr ? (CFG.QR_SIZE * 2 + QR_PAIR_GAP) : CFG.QR_SIZE;
  const labelBlockH = hasDualQr ? QR_LABEL_H + QR_LABEL_GAP : 0;
  const count = Math.max(1, networks.length);
  const cols = count === 1 ? 1 : 2;
  const rows = Math.ceil(count / cols);
  const gap = count === 1 ? 0 : CFG.MARGIN * scale;

  let tileW;
  let tileH;
  if (kind === 'card') {
    tileW = (CFG.CARD_W + CFG.MARGIN * 2) * scale;
    tileH = (maxCardH + CFG.MARGIN * 2) * scale;
  } else if (kind === 'qr') {
    tileW = (qrBlockW + CFG.MARGIN * 2) * scale;
    tileH = (CFG.MARGIN + labelBlockH + CFG.QR_SIZE + CFG.MARGIN) * scale;
  } else {
    tileW = (Math.max(CFG.CARD_W, qrBlockW) + CFG.MARGIN * 2) * scale;
    tileH = (CFG.MARGIN + labelBlockH + CFG.QR_SIZE + CFG.QR_CARD_GAP + maxCardH + CFG.MARGIN) * scale;
  }

  return {
    count,
    cols,
    rows,
    gap,
    tileW,
    tileH,
    hasDualQr,
    width: cols * tileW + (cols - 1) * gap,
    height: rows * tileH + (rows - 1) * gap,
  };
}

function renderQrLabel(ctx, text, centerX, y, s) {
  if (!text) return;
  ctx.save();
  ctx.fillStyle = '#333';
  ctx.font = `bold ${13 * s}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, centerX, y + (QR_LABEL_H * s) / 2);
  ctx.restore();
}

function renderNetworkQrBlock(ctx, network, x, y, tileW, s, includeLabels) {
  const entries = getNetworkQrEntries(network);
  const qrSize = CFG.QR_SIZE * s;
  const pairGap = QR_PAIR_GAP * s;
  const labelBlockH = includeLabels ? (QR_LABEL_H + QR_LABEL_GAP) * s : 0;
  const blockW = entries.length === 2 ? qrSize * 2 + pairGap : qrSize;
  let qrX = x + (tileW - blockW) / 2;
  const labelY = y + CFG.MARGIN * s;
  const qrY = labelY + labelBlockH;

  entries.forEach(entry => {
    if (includeLabels) renderQrLabel(ctx, entry.label, qrX + qrSize / 2, labelY, s);
    const qrC = makeQRCanvas(buildNetworkPayload(entry), qrSize);
    if (qrC) {
      ctx.drawImage(qrC, qrX, qrY);
      drawQRBorder(ctx, qrX, qrY, qrSize, s);
    }
    qrX += qrSize + pairGap;
  });

  return qrY + qrSize;
}

function renderNetworkComboTile(ctx, network, x, y, s, metrics) {
  const tileW = metrics.tileW;
  const includeLabels = metrics.hasDualQr;
  const qrBottom = renderNetworkQrBlock(ctx, network, x, y, tileW, s, includeLabels);

  const cardX = x + (tileW - CFG.CARD_W * s) / 2;
  const cardY = qrBottom + CFG.QR_CARD_GAP * s;
  renderCard(ctx, cardX, cardY, network.ssid, network.password, s, network.ssid5g || null);
}

function renderNetworkCardTile(ctx, network, x, y, s) {
  renderCard(ctx, x + CFG.MARGIN * s, y + CFG.MARGIN * s, network.ssid, network.password, s, network.ssid5g || null);
}

function renderNetworkGrid(kind, scale) {
  const s = scale;
  const networks = getRenderableNetworks(state);
  const metrics = getGridMetrics(kind, s);
  const c = document.createElement('canvas');
  c.width = metrics.width;
  c.height = metrics.height;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);

  networks.forEach((network, index) => {
    const col = index % metrics.cols;
    const row = Math.floor(index / metrics.cols);
    const x = col * (metrics.tileW + metrics.gap);
    const y = row * (metrics.tileH + metrics.gap);

    if (kind === 'card') renderNetworkCardTile(ctx, network, x, y, s);
    else if (kind === 'qr') renderNetworkQrBlock(ctx, network, x, y, metrics.tileW, s, metrics.hasDualQr);
    else renderNetworkComboTile(ctx, network, x, y, s, metrics);
  });

  return c;
}

function renderComboTiles(scale) {
  const s = scale;
  const networks = getRenderableNetworks(state);
  const metrics = getGridMetrics('combo', s);

  return networks.map(network => {
    const c = document.createElement('canvas');
    c.width = metrics.tileW;
    c.height = metrics.tileH;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    renderNetworkComboTile(ctx, network, 0, 0, s, metrics);
    return c;
  });
}

function renderCombo(scale) {
  return renderNetworkGrid('combo', scale);
}

/* ══════════════════════════════════════════════════════════════════════════
   RENDERIZAÇÃO SOMENTE CARD
   ══════════════════════════════════════════════════════════════════════════ */
function renderCardOnly(scale) {
  return renderNetworkGrid('card', scale);
}

/* ══════════════════════════════════════════════════════════════════════════
   RENDERIZAÇÃO SOMENTE QR
   ══════════════════════════════════════════════════════════════════════════ */
function renderQROnly(scale) {
  return renderNetworkGrid('qr', scale);
}

/* ══════════════════════════════════════════════════════════════════════════
   ATUALIZAÇÃO DO PREVIEW
   ══════════════════════════════════════════════════════════════════════════ */
function updatePreview() {
  const errors  = validate(state);
  const isValid = Object.keys(errors).length === 0 && state.ssid.trim() !== '';

  const previewEl  = document.getElementById('previewCanvas');
  const msgEl      = document.getElementById('validationMessage');
  const downloadBtns = document.querySelectorAll('.download-btn');

  if (isValid) {
    msgEl.classList.add('hidden');
    previewEl.style.display = 'block';
    downloadBtns.forEach(b => { b.disabled = false; });

    try {
      const combo = renderCombo(1);
      previewEl.width  = combo.width;
      previewEl.height = combo.height;
      previewEl.getContext('2d').drawImage(combo, 0, 0);
    } catch (e) {
      console.error('Preview render failed:', e);
    }
  } else {
    previewEl.style.display = 'none';
    msgEl.classList.remove('hidden');
    downloadBtns.forEach(b => { b.disabled = true; });

    /* Mensagem específica */
    if (!state.ssid.trim()) {
      msgEl.textContent = 'Preencha o SSID para gerar o preview.';
    } else {
      const msgs = Object.values(errors);
      msgEl.textContent = msgs.join(' ');
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   HELPER: DOWNLOAD DE CANVAS
   ══════════════════════════════════════════════════════════════════════════ */
function downloadCanvas(canvas, filename) {
  const a = document.createElement('a');
  a.download = filename;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

/* ══════════════════════════════════════════════════════════════════════════
   TOAST DE CONFIRMAÇÃO
   ══════════════════════════════════════════════════════════════════════════ */
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ══════════════════════════════════════════════════════════════════════════
   HELPER: BOTÃO COM LOADING STATE
   ══════════════════════════════════════════════════════════════════════════ */
const SPINNER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;

async function withButtonLoading(btn, label, asyncFn) {
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add('btn-loading');
  btn.innerHTML = `${SPINNER_SVG} ${label}`;
  /* Permite que a UI atualize antes do trabalho pesado */
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  try {
    await asyncFn();
  } finally {
    btn.disabled = false;
    btn.classList.remove('btn-loading');
    btn.innerHTML = original;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   EXIBIÇÃO DE ERROS NO FORMULÁRIO
   ══════════════════════════════════════════════════════════════════════════ */
function showErrors(errors) {
  document.querySelectorAll('.error-msg').forEach(el => { el.textContent = ''; });
  Object.entries(errors).forEach(([field, msg]) => {
    const el = document.getElementById(`${field}-error`);
    if (el) el.textContent = msg;
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   ESCALA DE EXPORTAÇÃO CONFORME QUALIDADE SELECIONADA
   ══════════════════════════════════════════════════════════════════════════ */
function exportScale() {
  const q = document.querySelector('input[name="quality"]:checked');
  return (q && q.value === 'high') ? CFG.SCALE_HIGH : CFG.SCALE_NORMAL;
}

function getCardPasswordValue(s) {
  return s.securityType === 'nopass' ? '' : s.password;
}

function syncPasswordToggleState() {
  const btn = document.getElementById('togglePassword');
  const pw  = document.getElementById('password');
  if (!btn || !pw) return;

  const isOpen = pw.type === 'text';
  const label  = isOpen ? 'Ocultar senha' : 'Mostrar senha';

  btn.classList.toggle('is-open', isOpen);
  btn.setAttribute('aria-pressed', String(isOpen));
  btn.setAttribute('aria-label', label);
  btn.title = label;
}

function updateSsidCounter(id) {
  const el = document.getElementById(id);
  const counter = document.getElementById(`${id}-counter`);
  if (!el || !counter) return;
  const len = el.value.length;
  counter.textContent = `${len}/32`;
  counter.classList.toggle('at-limit', len >= 32);
}

function escapeAttr(str) {
  return String(str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

function renderExtraNetworksForm() {
  const list = document.getElementById('extraNetworksList');
  const addBtn = document.getElementById('addExtraNetworkBtn');
  const hint = document.getElementById('extraNetworksHint');
  const section = document.getElementById('extraNetworksSection');
  if (!list || !addBtn || !hint || !section) return;

  state.extraNetworks = normalizeExtraNetworks(state.extraNetworks);
  const isEnterprise = state.securityType === 'WPA2-EAP';
  const isOpen = state.securityType === 'nopass';
  const used = getNetworkSlotsUsed(state);
  const canAdd = !isEnterprise && used < MAX_NETWORKS_PER_RECORD;

  section.classList.toggle('is-disabled', isEnterprise);
  addBtn.disabled = !canAdd;
  hint.textContent = isEnterprise
    ? 'Redes adicionais nao estao disponiveis para WPA2-EAP.'
    : `${used}/${MAX_NETWORKS_PER_RECORD} redes neste cadastro.`;

  list.innerHTML = state.extraNetworks.map((network, index) => `
    <div class="extra-network-card" data-index="${index}">
      <div class="extra-network-header">
        <strong>Rede adicional ${index + 1}</strong>
        <button type="button" class="remove-extra-network-btn" data-remove-extra="${index}">Remover</button>
      </div>
      <div class="form-group">
        <label for="extraNetworkSsid${index}">Nome da rede (SSID) <span class="required">*</span></label>
        <input type="text" id="extraNetworkSsid${index}" data-extra-index="${index}" data-extra-field="ssid" value="${escapeAttr(network.ssid)}" maxlength="32" placeholder="Ex: MinhaRede_Visitante">
        <span class="char-counter" id="extraNetworkSsid${index}-counter">${network.ssid.length}/32</span>
        <span class="error-msg" id="extraNetworkSsid${index}-error"></span>
      </div>
      <div class="form-group ${isOpen ? 'hidden' : ''}">
        <label for="extraNetworkPassword${index}">Senha <span class="required">*</span></label>
        <input type="text" id="extraNetworkPassword${index}" data-extra-index="${index}" data-extra-field="password" value="${escapeAttr(network.password)}" minlength="8" maxlength="128" placeholder="Senha da rede adicional">
        <span class="error-msg" id="extraNetworkPassword${index}-error"></span>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-extra-field]').forEach(input => {
    input.addEventListener('input', () => {
      const index = parseInt(input.dataset.extraIndex, 10);
      const field = input.dataset.extraField;
      if (!Number.isInteger(index) || !state.extraNetworks[index]) return;
      state.extraNetworks[index][field] = input.value;
      if (field === 'ssid') updateSsidCounter(input.id);
    });
  });

  list.querySelectorAll('[data-remove-extra]').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.removeExtra, 10);
      state.extraNetworks.splice(index, 1);
      renderExtraNetworksForm();
    });
  });

  state.extraNetworks.forEach((_, index) => updateSsidCounter(`extraNetworkSsid${index}`));
}

function addExtraNetwork() {
  if (state.securityType === 'WPA2-EAP') return;
  if (getNetworkSlotsUsed(state) >= MAX_NETWORKS_PER_RECORD) return;
  state.extraNetworks.push({ ssid: '', password: '' });
  renderExtraNetworksForm();
}

/* ══════════════════════════════════════════════════════════════════════════
   CONFIGURAÇÃO DO FORMULÁRIO
   ══════════════════════════════════════════════════════════════════════════ */
function setupForm() {

  /* ── Campos de texto / select ── */
  const ssidCounterIds = ['ssid', 'ssid5g'];
  ssidCounterIds.forEach(id => {
    const el      = document.getElementById(id);
    const counter = document.getElementById(`${id}-counter`);
    if (!el || !counter) return;
    const updateCounter = () => {
      const len = el.value.length;
      counter.textContent = `${len}/32`;
      counter.classList.toggle('at-limit', len >= 32);
    };
    el.addEventListener('input', updateCounter);
  });

  const textFields = ['ssid', 'ssid5g', 'password', 'identity', 'eapPassword', 'phase2', 'anonymousIdentity', 'contract'];
  textFields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      state[id] = el.value;
    });
  });

  /* ── Tipo de segurança ── */
  const secEl = document.getElementById('securityType');
  secEl.addEventListener('change', () => {
    state.securityType = secEl.value;
    const isEnterprise = state.securityType === 'WPA2-EAP';
    const isOpen       = state.securityType === 'nopass';
    document.getElementById('enterpriseFields').classList.toggle('enterprise-open', isEnterprise);
    document.getElementById('passwordGroup').classList.toggle('hidden', isOpen);

    if (isOpen) {
      const pwEl = document.getElementById('password');
      state.password = '';
      pwEl.value = '';
      pwEl.type = 'text';
      syncPasswordToggleState();
    }
    if (isEnterprise) {
      state.extraNetworks = [];
    }
    renderExtraNetworksForm();
  });

  /* ── EAP Method ── */
  const eapEl = document.getElementById('eapMethod');
  eapEl.addEventListener('change', () => {
    state.eapMethod = eapEl.value;
  });

  /* ── Rede oculta ── */
  const hiddenEl = document.getElementById('hidden');
  hiddenEl.addEventListener('change', () => {
    state.hidden = hiddenEl.checked;
    document.getElementById('hiddenLabel').textContent = state.hidden ? 'Sim' : 'Não';
  });

  /* ── Dual Band toggle ── */
  const dualBandEl = document.getElementById('dualBand');
  dualBandEl.addEventListener('change', () => {
    state.dualBand = dualBandEl.checked;
    const isActive = state.dualBand;
    document.getElementById('dualBandLabel').textContent = isActive ? 'Ativo' : 'Inativo';
    document.getElementById('ssid5gGroup').classList.toggle('hidden', isActive);
    document.getElementById('ssidLabelText').textContent = isActive
      ? 'Nome da rede (SSID)'
      : 'Nome da rede 2.4 GHz (SSID)';
    document.getElementById('ssid').placeholder = isActive ? 'Ex: MinhaRede' : 'Ex: MinhaRede_2.4G';
    renderExtraNetworksForm();
  });

  document.getElementById('addExtraNetworkBtn').addEventListener('click', addExtraNetwork);

  /* ── Toggle mostrar/ocultar senha ── */
  document.getElementById('togglePassword').addEventListener('click', () => {
    const pw = document.getElementById('password');
    pw.type = (pw.type === 'password') ? 'text' : 'password';
    syncPasswordToggleState();
  });

  /* ── Botão Limpar ── */
  document.getElementById('clearBtn').addEventListener('click', () => {
    exitEditMode();
    Object.assign(state, {
      ssid: '', ssid5g: '', dualBand: true, password: '', securityType: 'WPA', hidden: false,
      eapMethod: 'PEAP', identity: '', eapPassword: '',
      phase2: '', anonymousIdentity: '', contract: '', extraNetworks: [],
    });
    document.getElementById('wifiForm').reset();
    document.getElementById('password').type = 'text';
    document.getElementById('hiddenLabel').textContent = 'Não';
    document.getElementById('dualBandLabel').textContent = 'Ativo';
    document.getElementById('ssid5gGroup').classList.add('hidden');
    document.getElementById('ssidLabelText').textContent = 'Nome da rede (SSID)';
    document.getElementById('ssid').placeholder = 'Ex: MinhaRede';
    document.getElementById('enterpriseFields').classList.remove('enterprise-open');
    document.getElementById('passwordGroup').classList.remove('hidden');
    document.querySelectorAll('.error-msg').forEach(el => { el.textContent = ''; });
    syncPasswordToggleState();
    renderExtraNetworksForm();

    /* Reseta o preview */
    document.getElementById('previewCanvas').style.display = 'none';
    document.getElementById('validationMessage').classList.remove('hidden');
    document.querySelectorAll('.download-btn').forEach(b => { b.disabled = true; });
  });

  /* ── Download COMBO ── */
  document.getElementById('downloadCombo').addEventListener('click', async () => {
    const errors = validate(state);
    showErrors(errors);
    if (Object.keys(errors).length) return;
    const btn = document.getElementById('downloadCombo');
    await withButtonLoading(btn, 'Gerando...', async () => {
      downloadCanvas(renderCombo(exportScale()), 'WiFi.png');
    });
    showToast('Download COMBO iniciado!');
  });

  /* ── Download Card ── */
  document.getElementById('downloadCard').addEventListener('click', async () => {
    const errors = validate(state);
    showErrors(errors);
    if (Object.keys(errors).length) return;
    const btn = document.getElementById('downloadCard');
    await withButtonLoading(btn, 'Gerando...', async () => {
      downloadCanvas(renderCardOnly(exportScale()), 'card.png');
    });
    showToast('Download Card iniciado!');
  });

  /* ── Download QR ── */
  document.getElementById('downloadQR').addEventListener('click', async () => {
    const errors = validate(state);
    showErrors(errors);
    if (Object.keys(errors).length) return;
    const btn = document.getElementById('downloadQR');
    await withButtonLoading(btn, 'Gerando...', async () => {
      downloadCanvas(renderQROnly(exportScale()), 'qr.png');
    });
    showToast('Download QR iniciado!');
  });

  /* ── Imprimir ── */
  function getComboAspectRatio() {
    const metrics = getGridMetrics('combo', 1);
    return metrics.tileW / metrics.tileH;
  }

  function getPrintSize() {
    const mode = document.querySelector('input[name="printSize"]:checked').value;
    if (mode === 'full') return { pw: '18cm', ph: '26cm' };
    if (mode === 'custom') {
      const w = parseFloat(document.getElementById('printCustomW').value) || 9.2;
      const h = parseFloat(document.getElementById('printCustomH').value) || 12.0;
      return { pw: w + 'cm', ph: h + 'cm' };
    }
    const h = 12;
    return { pw: (h * getComboAspectRatio()).toFixed(1) + 'cm', ph: h + 'cm' };
  }

  document.querySelectorAll('input[name="printSize"]').forEach(r => {
    r.addEventListener('change', () => {
      document.getElementById('printCustomInputs').classList.toggle('visible', r.value === 'custom');
    });
  });

  document.getElementById('printCustomW').addEventListener('input', function () {
    const w = parseFloat(this.value);
    if (!isNaN(w) && w > 0) {
      document.getElementById('printCustomH').value = (w / getComboAspectRatio()).toFixed(1);
    }
  });

  document.getElementById('printCustomH').addEventListener('input', function () {
    const h = parseFloat(this.value);
    if (!isNaN(h) && h > 0) {
      document.getElementById('printCustomW').value = (h * getComboAspectRatio()).toFixed(1);
    }
  });

  const copiesInput   = document.getElementById('printCopies');
  const copiesDisplay = document.getElementById('copiesDisplay');
  document.getElementById('copiesDown').addEventListener('click', () => {
    const v = parseInt(copiesInput.value);
    if (v > 1) { copiesInput.value = v - 1; copiesDisplay.textContent = v - 1; }
  });
  document.getElementById('copiesUp').addEventListener('click', () => {
    const v = parseInt(copiesInput.value);
    if (v < 10) { copiesInput.value = v + 1; copiesDisplay.textContent = v + 1; }
  });

  document.getElementById('printBtn').addEventListener('click', () => {
    const errors = validate(state);
    showErrors(errors);
    if (Object.keys(errors).length) return;

    const { pw, ph } = getPrintSize();
    const rotated = document.querySelector('input[name="printOrientation"]:checked').value === 'landscape';
    const copies  = parseInt(copiesInput.value) || 1;

    // When rotated, the image is turned 90°: its visual footprint on the page is ph wide × pw tall.
    // The wrapper reserves that space in the flex layout; the <img> is absolutely positioned and rotated inside it.
    const wrapW = rotated ? ph : pw;
    const wrapH = rotated ? pw : ph;

    const dataUrls = renderComboTiles(CFG.SCALE_NORMAL).map(canvas => canvas.toDataURL('image/png'));
    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups para usar a função de impressão.'); return; }
    showToast('Preparando impressão...');

    const items = Array.from({ length: copies }, () => dataUrls)
      .flat()
      .map((dataUrl, index) => rotated
        ? `<div class="img-wrap"><img src="${dataUrl}" alt="Cartao Wi-Fi ${index + 1}"></div>`
        : `<img src="${dataUrl}" alt="Cartao Wi-Fi ${index + 1}">`)
      .join('\n  ');

    win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Wi-Fi - EspacoNet</title>
<style>
  @page {
    size: A4 portrait;
    margin: 0;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    width: 210mm;
    height: 297mm;
    background: #fff;
  }

  body {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    justify-content: center;
    box-sizing: border-box;
    padding: 0.5cm;
    gap: 0.4cm;
  }

  /* Portrait: imagem normal */
  img {
    width: ${pw};
    height: ${ph};
    object-fit: contain;
    display: block;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  /* Paisagem: wrapper reserva espaço girado; img é posicionada absolutamente e girada */
  .img-wrap {
    position: relative;
    width: ${wrapW};
    height: ${wrapH};
    flex-shrink: 0;
  }
  .img-wrap img {
    position: absolute;
    width: ${pw};
    height: ${ph};
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(90deg);
  }

  @media screen {
    html,
    body {
      width: 100%;
      height: 100%;
      min-height: 100vh;
    }
  }
</style>
</head>
<body>
  ${items}
  <script>
    window.addEventListener('load', () => {
      window.focus();
      window.print();
      setTimeout(() => window.close(), 500);
    });
  </script>
</body>
</html>`);
    win.document.close();
  });

  /* ── Salvar PDF ── */
  document.getElementById('savePdfBtn').addEventListener('click', async () => {
    const errors = validate(state);
    showErrors(errors);
    if (Object.keys(errors).length) return;

    const btn = document.getElementById('savePdfBtn');
    await withButtonLoading(btn, 'Gerando PDF...', async () => {
      const { pw, ph } = getPrintSize();
      const isLandscape = document.querySelector('input[name="printOrientation"]:checked').value === 'landscape';
      const copies = parseInt(document.getElementById('printCopies').value) || 1;

      const tileCanvases = renderComboTiles(CFG.SCALE_NORMAL);
      const dataUrls = tileCanvases.map(src => {
        if (!isLandscape) return src.toDataURL('image/png');

        const rotatedCanvas = document.createElement('canvas');
        rotatedCanvas.width = src.height;
        rotatedCanvas.height = src.width;
        const rc = rotatedCanvas.getContext('2d');
        rc.translate(src.height, 0);
        rc.rotate(Math.PI / 2);
        rc.drawImage(src, 0, 0);
        return rotatedCanvas.toDataURL('image/png');
      });
      const pdfImages = Array.from({ length: copies }, () => dataUrls).flat();

      // Dimensões da imagem no PDF em mm (invertidas se landscape, pois a imagem já está rotacionada)
      const imgW = (isLandscape ? parseFloat(ph) : parseFloat(pw)) * 10;
      const imgH = (isLandscape ? parseFloat(pw) : parseFloat(ph)) * 10;

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });

      const pageW = 210, pageH = 297;
      const margin = 5, gap = 4;

      // Quantas cópias cabem por linha (centralizado horizontalmente)
      const cols = Math.max(1, Math.floor((pageW - 2 * margin + gap) / (imgW + gap)));

      let y = margin;

      for (let i = 0; i < pdfImages.length; ) {
        // Nova página se ultrapassar altura disponível
        if (i > 0 && y + imgH > pageH - margin) {
          doc.addPage();
          y = margin;
        }

        // Quantas imagens cabem nesta linha e centraliza a linha na página
        const rowCount = Math.min(cols, pdfImages.length - i);
        const rowW = rowCount * imgW + (rowCount - 1) * gap;
        const startX = (pageW - rowW) / 2;

        let x = startX;
        for (let j = 0; j < rowCount; j++) {
          doc.addImage(pdfImages[i + j], 'PNG', x, y, imgW, imgH);
          x += imgW + gap;
        }

        i += rowCount;
        y += imgH + gap;
      }

      const ssid = document.getElementById('ssid').value || 'WiFi';
      doc.save(`WiFi-${ssid}.pdf`);
    });
    showToast('PDF gerado!');
  });

  /* ── Qualidade altera o preview se já estiver visível ── */
  document.querySelectorAll('input[name="quality"]').forEach(r => {
    r.addEventListener('change', () => {
      if (document.getElementById('previewCanvas').style.display !== 'none') {
        updatePreview();
      }
    });
  });

  /* ── Botão Gerar QR Wi-Fi ── */
  document.getElementById('generateBtn').addEventListener('click', async () => {
    const errors = validate(state);
    showErrors(errors);
    if (Object.keys(errors).length) return;

    /* Renderiza o preview */
    updatePreview();

    /* Salva/atualiza no banco de dados */
    const btn = document.getElementById('generateBtn');
    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
           stroke-linejoin="round" class="spin">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Salvando...`;

    const payload = {
      ssid:              state.ssid,
      ssid5g:            state.ssid5g,
      dualBand:          state.dualBand,
      password:          state.password,
      security:          state.securityType,
      hidden:            state.hidden,
      eapMethod:         state.eapMethod,
      identity:          state.identity,
      eapPassword:       state.eapPassword,
      phase2:            state.phase2,
      anonymousIdentity: state.anonymousIdentity,
      contract:          state.contract || null,
      extraNetworks:     normalizeExtraNetworks(state.extraNetworks),
    };

    try {
      const isEditing = editingId !== null;
      const url    = isEditing ? `/api/networks/${editingId}` : '/api/networks';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const record = await res.json();
        if (isEditing) {
          updateHistoryItem(record);
          exitEditMode();
          showToast('Rede atualizada com sucesso!');
        } else {
          prependToHistory([record]);
          if (!latestTimestamp || record.createdAt > latestTimestamp) {
            latestTimestamp = record.createdAt;
          }
        }
      } else {
        const data = await res.json().catch(() => null);
        console.error('Erro ao salvar:', data);
      }
    } catch (e) {
      console.error('Erro de rede ao salvar:', e);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });

  syncPasswordToggleState();
  renderExtraNetworksForm();

  /* ── Cancelar edição ── */
  document.getElementById('cancelEditBtn').addEventListener('click', () => {
    exitEditMode();
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   BUSCA NO HISTÓRICO
   ══════════════════════════════════════════════════════════════════════════ */
function setupHistorySearch() {
  const searchEl = document.getElementById('historySearch');
  if (!searchEl) return;

  const iconEl = document.querySelector('.history-search-icon');

  searchEl.addEventListener('input', () => {
    const q = searchEl.value.trim().toLowerCase();

    if (iconEl) iconEl.style.opacity = searchEl.value ? '0' : '1';

    document.querySelectorAll('#historyList .history-item').forEach(item => {
      const ssid     = item.dataset.ssid     || '';
      const contract = item.dataset.contract || '';
      const visible  = !q || ssid.includes(q) || contract.includes(q);
      item.style.display = visible ? '' : 'none';
    });
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   HISTÓRICO — POLLING & RENDERIZAÇÃO
   ══════════════════════════════════════════════════════════════════════════ */
let latestTimestamp    = null;
let pollInterval      = null;
let initialFetchDone  = false;
const POLL_MS         = 5000;
const knownIds        = new Set();

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function removeSkeleton() {
  const skel = document.getElementById('historySkeleton');
  if (skel) skel.remove();
}

async function fetchHistory() {
  try {
    const url = latestTimestamp
      ? `/api/networks?since=${encodeURIComponent(latestTimestamp)}`
      : '/api/networks?limit=50';

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const { networks } = await res.json();

    /* Remove skeleton na primeira resposta */
    if (!initialFetchDone) {
      initialFetchDone = true;
      removeSkeleton();
    }

    /* Filtra duplicatas (pode acontecer em race conditions) */
    const fresh = networks.filter(n => !knownIds.has(n.id));

    if (fresh.length > 0) {
      if (!latestTimestamp) {
        /* Carga inicial — renderiza em ordem (mais recentes primeiro) */
        fresh.forEach(n => knownIds.add(n.id));
        renderInitialHistory(fresh);
      } else {
        prependToHistory(fresh);
      }

      /* Atualiza timestamp para o registro mais recente */
      const newest = fresh.reduce(
        (a, b) => (a.createdAt > b.createdAt ? a : b),
        fresh[0]
      );
      if (!latestTimestamp || newest.createdAt > latestTimestamp) {
        latestTimestamp = newest.createdAt;
      }
    } else if (!latestTimestamp) {
      /* Nenhum item no banco — mostra estado vazio */
      checkEmptyHistory();
    }

    setSyncStatus('ok', 'Sincronizado');
  } catch (e) {
    console.error('Polling error:', e);
    /* Remove skeleton mesmo em erro para não ficar pulsando infinitamente */
    if (!initialFetchDone) {
      initialFetchDone = true;
      removeSkeleton();
      checkEmptyHistory();
    }
    setSyncStatus('error', 'Sem conexão');
  }
}

function setSyncStatus(status, text) {
  const dot  = document.querySelector('.sync-dot');
  const span = document.getElementById('syncText');
  if (dot)  { dot.className = 'sync-dot ' + status; }
  if (span) { span.textContent = text; }
}

function startPolling() {
  fetchHistory();
  pollInterval = setInterval(fetchHistory, POLL_MS);
}

/* Pausa polling quando a aba está oculta */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInterval(pollInterval);
    pollInterval = null;
  } else {
    startPolling();
  }
});

function renderInitialHistory(networks) {
  const list    = document.getElementById('historyList');
  const emptyEl = document.getElementById('historyEmpty');
  if (networks.length > 0 && emptyEl) emptyEl.remove();

  networks.forEach(n => {
    list.appendChild(createHistoryItem(n));
  });
}

function prependToHistory(networks) {
  const list    = document.getElementById('historyList');
  const emptyEl = document.getElementById('historyEmpty');
  if (emptyEl) emptyEl.remove();

  /* Mais recentes primeiro — inverte pra inserir no topo na ordem certa */
  const sorted = [...networks].sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  );

  sorted.forEach(n => {
    if (knownIds.has(n.id)) return;
    knownIds.add(n.id);

    const el = createHistoryItem(n);
    el.style.animation = 'fadeSlideIn 0.3s ease';
    list.prepend(el);
  });
}

function getSavedNetworkCount(network) {
  const extras = normalizeExtraNetworks(network.extraNetworks);
  return 1 + extras.length;
}

function getHistorySearchText(network) {
  const extras = normalizeExtraNetworks(network.extraNetworks).map(n => n.ssid);
  return [network.ssid, network.ssid5g, ...extras].filter(Boolean).join(' ').toLowerCase();
}

function createHistoryItem(network) {
  const secLabels = { WPA: 'WPA', WEP: 'WEP', nopass: 'Aberta', 'WPA2-EAP': 'Enterprise' };
  const date = new Date(network.createdAt);
  const timeStr = date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

  const div = document.createElement('div');
  div.className = 'history-item';
  div.dataset.id = network.id;
  div.dataset.ssid = getHistorySearchText(network);
  div.dataset.contract = (network.contract || '').toLowerCase();
  const networkCount = getSavedNetworkCount(network);

  const contractHtml = network.contract
    ? `<span class="history-contract">${escapeHtml(network.contract)}</span>`
    : '';

  div.innerHTML = `
    <div class="history-item-info">
      <strong class="history-ssid">${escapeHtml(network.ssid)}</strong>
      ${contractHtml}
      <span class="history-meta">
        ${secLabels[network.security] || network.security}
        ${network.hidden ? ' &middot; Oculta' : ''}
        ${networkCount > 1 ? ` &middot; ${networkCount} redes` : ''}
        &middot; ${timeStr}
      </span>
    </div>
    <div class="history-item-actions">
      <button class="history-action-btn load" title="Carregar no formulário">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
             stroke-linejoin="round">
          <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
        </svg>
      </button>
      <button class="history-action-btn edit" title="Editar">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
             stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="history-action-btn delete" title="Excluir">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
             stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
  `;

  /* Carregar no formulário (sem entrar em modo de edição) */
  div.querySelector('.load').addEventListener('click', () => {
    loadNetworkIntoForm(network, false);
  });

  /* Editar */
  div.querySelector('.edit').addEventListener('click', () => {
    loadNetworkIntoForm(network, true);
  });

  /* Excluir */
  div.querySelector('.delete').addEventListener('click', async () => {
    if (!confirm(`Excluir "${network.ssid}"?`)) return;
    try {
      await fetch(`/api/networks/${network.id}`, { method: 'DELETE' });
      if (editingId === network.id) exitEditMode();
      div.remove();
      knownIds.delete(network.id);
      checkEmptyHistory();
    } catch (e) {
      console.error('Erro ao excluir:', e);
    }
  });

  return div;
}

function loadNetworkIntoForm(network, enterEditMode = false) {
  /* Atualiza state */
  state.ssid              = network.ssid;
  state.ssid5g            = network.ssid5g || '';
  state.dualBand          = network.dualBand !== false;
  state.password          = network.password || '';
  state.securityType      = network.security;
  state.hidden            = network.hidden;
  state.eapMethod         = network.eapMethod || 'PEAP';
  state.identity          = network.identity || '';
  state.eapPassword       = network.eapPassword || '';
  state.phase2            = network.phase2 || '';
  state.anonymousIdentity = network.anonymousIdentity || '';
  state.contract          = network.contract || '';
  state.extraNetworks     = normalizeExtraNetworks(network.extraNetworks);

  /* Sincroniza DOM */
  document.getElementById('ssid').value            = state.ssid;
  document.getElementById('ssid5g').value          = state.ssid5g;
  document.getElementById('dualBand').checked      = state.dualBand;
  document.getElementById('dualBandLabel').textContent = state.dualBand ? 'Ativo' : 'Inativo';
  document.getElementById('ssid5gGroup').classList.toggle('hidden', state.dualBand);
  document.getElementById('ssidLabelText').textContent = state.dualBand
    ? 'Nome da rede (SSID)'
    : 'Nome da rede 2.4 GHz (SSID)';
  document.getElementById('ssid').placeholder = state.dualBand ? 'Ex: MinhaRede' : 'Ex: MinhaRede_2.4G';
  (['ssid', 'ssid5g']).forEach(id => {
    const counter = document.getElementById(`${id}-counter`);
    const el      = document.getElementById(id);
    if (!counter || !el) return;
    const len = el.value.length;
    counter.textContent = `${len}/32`;
    counter.classList.toggle('at-limit', len >= 32);
  });
  document.getElementById('password').value        = state.password;
  document.getElementById('securityType').value    = state.securityType;
  document.getElementById('hidden').checked        = state.hidden;
  document.getElementById('hiddenLabel').textContent = state.hidden ? 'Sim' : 'Não';
  document.getElementById('eapMethod').value       = state.eapMethod;
  document.getElementById('identity').value        = state.identity;
  document.getElementById('eapPassword').value     = state.eapPassword;
  document.getElementById('phase2').value          = state.phase2;
  document.getElementById('anonymousIdentity').value = state.anonymousIdentity;
  document.getElementById('contract').value        = state.contract;

  /* Toggle seções de enterprise / password */
  const isEnterprise = state.securityType === 'WPA2-EAP';
  const isOpen       = state.securityType === 'nopass';
  document.getElementById('enterpriseFields').classList.toggle('enterprise-open', isEnterprise);
  document.getElementById('passwordGroup').classList.toggle('hidden', isOpen);
  renderExtraNetworksForm();

  /* Modo de edição */
  if (enterEditMode) {
    editingId = network.id;
    const banner = document.getElementById('editModeBanner');
    banner.classList.remove('hidden');
    document.getElementById('editModeBannerText').textContent =
      `Editando: ${network.ssid}`;
    const btn = document.getElementById('generateBtn');
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
           stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      Salvar Edição`;
  }

  /* Renderiza preview imediatamente */
  updatePreview();

  /* Scroll até o formulário */
  document.querySelector('.form-column').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exitEditMode() {
  editingId = null;
  document.getElementById('editModeBanner').classList.add('hidden');
  const btn = document.getElementById('generateBtn');
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
         stroke-linejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
    Gerar QR Wi-Fi`;
}

function updateHistoryItem(network) {
  const div = document.querySelector(`.history-item[data-id="${network.id}"]`);
  if (!div) return;

  const secLabels = { WPA: 'WPA', WEP: 'WEP', nopass: 'Aberta', 'WPA2-EAP': 'Enterprise' };
  const date    = new Date(network.createdAt);
  const timeStr = date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

  div.dataset.ssid     = getHistorySearchText(network);
  div.dataset.contract = (network.contract || '').toLowerCase();
  const networkCount = getSavedNetworkCount(network);

  const contractHtml = network.contract
    ? `<span class="history-contract">${escapeHtml(network.contract)}</span>`
    : '';

  div.querySelector('.history-item-info').innerHTML = `
    <strong class="history-ssid">${escapeHtml(network.ssid)}</strong>
    ${contractHtml}
    <span class="history-meta">
      ${secLabels[network.security] || network.security}
      ${network.hidden ? ' &middot; Oculta' : ''}
      ${networkCount > 1 ? ` &middot; ${networkCount} redes` : ''}
      &middot; ${timeStr}
    </span>
  `;

  /* Atualiza os dados do closure nos botões — recria o item para simplificar */
  const newDiv = createHistoryItem(network);
  div.replaceWith(newDiv);
}

function checkEmptyHistory() {
  const list = document.getElementById('historyList');
  if (list.querySelectorAll('.history-item').length === 0 && !document.getElementById('historyEmpty')) {
    const p = document.createElement('p');
    p.className = 'history-empty';
    p.id = 'historyEmpty';
    p.innerHTML = `<svg class="empty-icon" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Nenhuma rede salva ainda.`;
    list.appendChild(p);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
   ══════════════════════════════════════════════════════════════════════════ */
async function init() {
  await Promise.all([
    loadImg('logo', 'assets/logo_espaconet.png'),
    loadImg('wifi', 'assets/wifi.png'),
  ]);
  setupForm();
  setupHistorySearch();
  startPolling();
}

init();
