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
};

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

/* ══════════════════════════════════════════════════════════════════════════
   VALIDAÇÃO
   ══════════════════════════════════════════════════════════════════════════ */
function validate(s) {
  const err = {};
  if (!s.ssid.trim())                                    err.ssid     = 'SSID é obrigatório.';
  if (!s.dualBand && !s.ssid5g.trim())                   err.ssid5g   = 'SSID 5 GHz é obrigatório.';
  if (s.securityType !== 'nopass' && s.securityType !== 'WPA2-EAP' && !s.password)
                                                          err.password = 'Senha é obrigatória.';
  if (s.securityType === 'WPA2-EAP') {
    if (!s.identity.trim())                              err.identity    = 'Identity é obrigatório.';
    if (!s.eapPassword)                                  err.eapPassword = 'Password é obrigatório.';
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
function renderCombo(scale) {
  const s      = scale;
  const isDual = !state.dualBand;
  const cardH  = isDual ? CFG.CARD_H_3ROW : CFG.CARD_H;
  const cW = CFG.COMBO_W * s;
  const cH = (CFG.MARGIN + CFG.QR_SIZE + CFG.QR_CARD_GAP + cardH + CFG.MARGIN) * s;

  const c   = document.createElement('canvas');
  c.width   = cW;
  c.height  = cH;
  const ctx = c.getContext('2d');

  /* Fundo branco */
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cW, cH);

  /* QR */
  const payload = buildPayload(state);
  const qrC     = makeQRCanvas(payload, CFG.QR_SIZE * s);
  if (qrC) {
    const qrX = (cW - CFG.QR_SIZE * s) / 2;
    const qrY = CFG.MARGIN * s;
    ctx.drawImage(qrC, qrX, qrY);
    drawQRBorder(ctx, qrX, qrY, CFG.QR_SIZE * s, s);
  }

  /* Card */
  const cardX = (cW - CFG.CARD_W * s) / 2;
  const cardY = (CFG.MARGIN + CFG.QR_SIZE + CFG.QR_CARD_GAP) * s;
  renderCard(ctx, cardX, cardY, state.ssid, getCardPasswordValue(state), s, isDual ? state.ssid5g : null);

  return c;
}

/* ══════════════════════════════════════════════════════════════════════════
   RENDERIZAÇÃO SOMENTE CARD
   ══════════════════════════════════════════════════════════════════════════ */
function renderCardOnly(scale) {
  const s      = scale;
  const isDual = !state.dualBand;
  const cardH  = isDual ? CFG.CARD_H_3ROW : CFG.CARD_H;
  const m  = CFG.MARGIN * s;
  const cW = CFG.CARD_W * s + m * 2;
  const cH = cardH * s + m * 2;

  const c   = document.createElement('canvas');
  c.width   = cW;
  c.height  = cH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cW, cH);
  renderCard(ctx, m, m, state.ssid, getCardPasswordValue(state), s, isDual ? state.ssid5g : null);
  return c;
}

/* ══════════════════════════════════════════════════════════════════════════
   RENDERIZAÇÃO SOMENTE QR
   ══════════════════════════════════════════════════════════════════════════ */
function renderQROnly(scale) {
  const s  = scale;
  const m  = CFG.MARGIN * s;
  const sz = CFG.QR_SIZE * s;
  const dim = sz + m * 2;

  const c   = document.createElement('canvas');
  c.width   = dim;
  c.height  = dim;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, dim, dim);

  const payload = buildPayload(state);
  const qrC     = makeQRCanvas(payload, sz);
  if (qrC) {
    ctx.drawImage(qrC, m, m);
    drawQRBorder(ctx, m, m, sz, s);
  }
  return c;
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

/* ══════════════════════════════════════════════════════════════════════════
   CONFIGURAÇÃO DO FORMULÁRIO
   ══════════════════════════════════════════════════════════════════════════ */
function setupForm() {

  /* ── Campos de texto / select ── */
  const textFields = ['ssid', 'ssid5g', 'password', 'identity', 'eapPassword', 'phase2', 'anonymousIdentity'];
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
  });

  /* ── Toggle mostrar/ocultar senha ── */
  document.getElementById('togglePassword').addEventListener('click', () => {
    const pw = document.getElementById('password');
    pw.type = (pw.type === 'password') ? 'text' : 'password';
    syncPasswordToggleState();
  });

  /* ── Botão Limpar ── */
  document.getElementById('clearBtn').addEventListener('click', () => {
    Object.assign(state, {
      ssid: '', ssid5g: '', dualBand: true, password: '', securityType: 'WPA', hidden: false,
      eapMethod: 'PEAP', identity: '', eapPassword: '',
      phase2: '', anonymousIdentity: '',
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
    const cardH = state.dualBand ? CFG.CARD_H : CFG.CARD_H_3ROW;
    const comboH = CFG.MARGIN + CFG.QR_SIZE + CFG.QR_CARD_GAP + cardH + CFG.MARGIN;
    return CFG.COMBO_W / comboH;
  }

  function getPrintSize() {
    const mode = document.querySelector('input[name="printSize"]:checked').value;
    if (mode === 'full') return { pw: '18cm', ph: '26cm' };
    if (mode === 'custom') {
      const w = parseFloat(document.getElementById('printCustomW').value) || 11.2;
      const h = parseFloat(document.getElementById('printCustomH').value) || 13.0;
      return { pw: w + 'cm', ph: h + 'cm' };
    }
    return { pw: '11.2cm', ph: '13cm' };
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

  document.getElementById('printBtn').addEventListener('click', () => {
    const errors = validate(state);
    showErrors(errors);
    if (Object.keys(errors).length) return;

    const { pw, ph } = getPrintSize();
    const dataUrl = renderCombo(CFG.SCALE_NORMAL).toDataURL('image/png');
    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups para usar a função de impressão.'); return; }
    showToast('Preparando impressão...');
    win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Wi-Fi - EspacoNet</title>
<style>
  :root {
    --print-width: ${pw};
    --print-height: ${ph};
  }

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
    align-items: flex-start;
    justify-content: center;
    box-sizing: border-box;
    padding-top: 1cm;
  }

  img {
    width: var(--print-width);
    height: var(--print-height);
    object-fit: contain;
    display: block;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
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
  <img src="${dataUrl}" alt="Cartao Wi-Fi">
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

    /* Salva no banco de dados */
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

    try {
      const res = await fetch('/api/networks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ssid:              state.ssid,
          password:          state.password,
          security:          state.securityType,
          hidden:            state.hidden,
          eapMethod:         state.eapMethod,
          identity:          state.identity,
          eapPassword:       state.eapPassword,
          phase2:            state.phase2,
          anonymousIdentity: state.anonymousIdentity,
        }),
      });

      if (res.ok) {
        const record = await res.json();
        prependToHistory([record]);
        if (!latestTimestamp || record.createdAt > latestTimestamp) {
          latestTimestamp = record.createdAt;
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

  div.innerHTML = `
    <div class="history-item-info">
      <strong class="history-ssid">${escapeHtml(network.ssid)}</strong>
      <span class="history-meta">
        ${secLabels[network.security] || network.security}
        ${network.hidden ? ' &middot; Oculta' : ''}
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

  /* Carregar no formulário */
  div.querySelector('.load').addEventListener('click', () => {
    loadNetworkIntoForm(network);
  });

  /* Excluir */
  div.querySelector('.delete').addEventListener('click', async () => {
    if (!confirm(`Excluir "${network.ssid}"?`)) return;
    try {
      await fetch(`/api/networks/${network.id}`, { method: 'DELETE' });
      div.remove();
      knownIds.delete(network.id);
      checkEmptyHistory();
    } catch (e) {
      console.error('Erro ao excluir:', e);
    }
  });

  return div;
}

function loadNetworkIntoForm(network) {
  /* Atualiza state */
  state.ssid              = network.ssid;
  state.password          = network.password || '';
  state.securityType      = network.security;
  state.hidden            = network.hidden;
  state.eapMethod         = network.eapMethod || 'PEAP';
  state.identity          = network.identity || '';
  state.eapPassword       = network.eapPassword || '';
  state.phase2            = network.phase2 || '';
  state.anonymousIdentity = network.anonymousIdentity || '';

  /* Sincroniza DOM */
  document.getElementById('ssid').value            = state.ssid;
  document.getElementById('password').value        = state.password;
  document.getElementById('securityType').value    = state.securityType;
  document.getElementById('hidden').checked        = state.hidden;
  document.getElementById('hiddenLabel').textContent = state.hidden ? 'Sim' : 'Não';
  document.getElementById('eapMethod').value       = state.eapMethod;
  document.getElementById('identity').value        = state.identity;
  document.getElementById('eapPassword').value     = state.eapPassword;
  document.getElementById('phase2').value          = state.phase2;
  document.getElementById('anonymousIdentity').value = state.anonymousIdentity;

  /* Toggle seções de enterprise / password */
  const isEnterprise = state.securityType === 'WPA2-EAP';
  const isOpen       = state.securityType === 'nopass';
  document.getElementById('enterpriseFields').classList.toggle('enterprise-open', isEnterprise);
  document.getElementById('passwordGroup').classList.toggle('hidden', isOpen);

  /* Renderiza preview imediatamente */
  updatePreview();

  /* Scroll até o preview */
  document.querySelector('.preview-column').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  startPolling();
}

init();
