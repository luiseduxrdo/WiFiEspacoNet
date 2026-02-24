'use strict';

/* ══════════════════════════════════════════════════════════════════════════
   CONFIGURAÇÃO DE LAYOUT (unidades lógicas — pixels em escala 1x)
   ══════════════════════════════════════════════════════════════════════════ */
const CFG = {
  /* QR code */
  QR_SIZE: 320,           // tamanho do módulo QR (sem margens externas)
  QR_BORDER_GAP_RATIO: 0.015, // afastamento proporcional ao tamanho do QR
  QR_BORDER_GAP_MIN: 4,    // afastamento mínimo em px (escala 1x)
  QR_BORDER_WIDTH: 5,      // espessura da borda decorativa
  QR_BORDER_RADIUS: 3,    // raio de canto da borda decorativa

  /* Card Wi-Fi */
  CARD_W:    380,
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
CFG.ROW_H   = (CFG.CARD_H - CFG.HEADER_H) / 2;           // altura de cada linha da tabela
CFG.COMBO_W = Math.max(CFG.QR_SIZE, CFG.CARD_W) + CFG.MARGIN * 2;
CFG.COMBO_H = CFG.MARGIN + CFG.QR_SIZE + CFG.QR_CARD_GAP + CFG.CARD_H + CFG.MARGIN;

/* ══════════════════════════════════════════════════════════════════════════
   ESTADO DO FORMULÁRIO
   ══════════════════════════════════════════════════════════════════════════ */
const state = {
  ssid:            '',
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
  if (!s.ssid.trim())                                    err.ssid        = 'SSID é obrigatório.';
  if (s.securityType !== 'nopass' && s.securityType !== 'WPA2-EAP' && !s.password)
                                                          err.password    = 'Senha é obrigatória.';
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
function renderCard(ctx, x, y, ssid, password, s) {
  const W  = CFG.CARD_W  * s;
  const H  = CFG.CARD_H  * s;
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

  /* Linha entre as duas linhas da tabela */
  ctx.beginPath();
  ctx.moveTo(x,     y + hH + rH);
  ctx.lineTo(x + W, y + hH + rH);
  ctx.stroke();

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

  /* ── Rótulos "Nome" e "Senha" */
  ctx.fillStyle   = '#333';
  ctx.font        = `bold ${13 * CARD_TEXT_SCALE * s}px Arial, sans-serif`;
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Nome',  x + lW / 2, y + hH + rH / 2);
  ctx.fillText('Senha', x + lW / 2, y + hH + rH + rH / 2);

  /* ── Valores (SSID e Senha) */
  const monoFont = `'Courier New', Courier, monospace`;
  drawFittedText(ctx, ssid,     x + lW, y + hH,      W - lW, rH, 14 * CARD_TEXT_SCALE * s, 8.5 * CARD_TEXT_SCALE * s, monoFont);
  drawFittedText(ctx, password, x + lW, y + hH + rH, W - lW, rH, 14 * CARD_TEXT_SCALE * s, 8.5 * CARD_TEXT_SCALE * s, monoFont);
}

/* ══════════════════════════════════════════════════════════════════════════
   RENDERIZAÇÃO DO COMBO (QR + card)
   ══════════════════════════════════════════════════════════════════════════ */
function renderCombo(scale) {
  const s  = scale;
  const cW = CFG.COMBO_W * s;
  const cH = CFG.COMBO_H * s;

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
  renderCard(ctx, cardX, cardY, state.ssid, state.password, s);

  return c;
}

/* ══════════════════════════════════════════════════════════════════════════
   RENDERIZAÇÃO SOMENTE CARD
   ══════════════════════════════════════════════════════════════════════════ */
function renderCardOnly(scale) {
  const s  = scale;
  const m  = CFG.MARGIN * s;
  const cW = CFG.CARD_W * s + m * 2;
  const cH = CFG.CARD_H * s + m * 2;

  const c   = document.createElement('canvas');
  c.width   = cW;
  c.height  = cH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cW, cH);
  renderCard(ctx, m, m, state.ssid, state.password, s);
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
  const textFields = ['ssid', 'password', 'identity', 'eapPassword', 'phase2', 'anonymousIdentity'];
  textFields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      state[id] = el.value;
      updatePreview();
    });
  });

  /* ── Tipo de segurança ── */
  const secEl = document.getElementById('securityType');
  secEl.addEventListener('change', () => {
    state.securityType = secEl.value;
    const isEnterprise = state.securityType === 'WPA2-EAP';
    const isOpen       = state.securityType === 'nopass';
    document.getElementById('enterpriseFields').classList.toggle('hidden', !isEnterprise);
    document.getElementById('passwordGroup').classList.toggle('hidden', isOpen);
    updatePreview();
  });

  /* ── EAP Method ── */
  const eapEl = document.getElementById('eapMethod');
  eapEl.addEventListener('change', () => {
    state.eapMethod = eapEl.value;
    updatePreview();
  });

  /* ── Rede oculta ── */
  const hiddenEl = document.getElementById('hidden');
  hiddenEl.addEventListener('change', () => {
    state.hidden = hiddenEl.checked;
    document.getElementById('hiddenLabel').textContent = state.hidden ? 'Sim' : 'Não';
    updatePreview();
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
      ssid: '', password: '', securityType: 'WPA', hidden: false,
      eapMethod: 'PEAP', identity: '', eapPassword: '',
      phase2: '', anonymousIdentity: '',
    });
    document.getElementById('wifiForm').reset();
    document.getElementById('password').type = 'password';
    document.getElementById('hiddenLabel').textContent = 'Não';
    document.getElementById('enterpriseFields').classList.add('hidden');
    document.getElementById('passwordGroup').classList.remove('hidden');
    document.querySelectorAll('.error-msg').forEach(el => { el.textContent = ''; });
    syncPasswordToggleState();
    updatePreview();
  });

  /* ── Download COMBO ── */
  document.getElementById('downloadCombo').addEventListener('click', () => {
    const errors = validate(state);
    showErrors(errors);
    if (Object.keys(errors).length) return;
    downloadCanvas(renderCombo(exportScale()), 'combo.png');
  });

  /* ── Download Card ── */
  document.getElementById('downloadCard').addEventListener('click', () => {
    const errors = validate(state);
    showErrors(errors);
    if (Object.keys(errors).length) return;
    downloadCanvas(renderCardOnly(exportScale()), 'card.png');
  });

  /* ── Download QR ── */
  document.getElementById('downloadQR').addEventListener('click', () => {
    const errors = validate(state);
    showErrors(errors);
    if (Object.keys(errors).length) return;
    downloadCanvas(renderQROnly(exportScale()), 'qr.png');
  });

  /* ── Imprimir ── */
  document.getElementById('printBtn').addEventListener('click', () => {
    const errors = validate(state);
    showErrors(errors);
    if (Object.keys(errors).length) return;

    const dataUrl = renderCombo(CFG.SCALE_NORMAL).toDataURL('image/png');
    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups para usar a função de impressão.'); return; }
    win.document.write(`<!DOCTYPE html>
<html><head><title>Wi-Fi — EspaçoNet</title>
<style>
  body { margin:0; display:flex; justify-content:center; align-items:flex-start; padding:20px; }
  img  { max-width:100%; height:auto; }
  @media print { body { padding:0; } }
</style></head>
<body><img src="${dataUrl}" onload="window.print();setTimeout(()=>window.close(),500);"></body>
</html>`);
    win.document.close();
  });

  /* ── Qualidade altera o preview também ── */
  document.querySelectorAll('input[name="quality"]').forEach(r => {
    r.addEventListener('change', updatePreview);
  });

  syncPasswordToggleState();
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
  updatePreview();
}

init();
