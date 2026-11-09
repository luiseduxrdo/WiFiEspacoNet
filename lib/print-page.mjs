export function renderPrintPage({ dataUrls, pw, ph, rotated, copies }, { temporary = false } = {}) {
  const items = Array.from({ length: copies }, () => dataUrls).flat()
    .map((url, i) => `<div class="tile${rotated ? ' rotated' : ''}"><img src="${url}" alt="Cartão Wi-Fi ${i + 1}"></div>`).join('\n');
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="referrer" content="no-referrer">
<title>Impressão Wi-Fi — EspaçoNet</title>
<style>
@page { size: A4 portrait; margin: 0; }
html, body { margin: 0; padding: 0; width: 210mm; min-height: 297mm; background: white; }
body { display: flex; flex-wrap: wrap; align-content: flex-start; justify-content: center;
  box-sizing: border-box; padding: .5cm; gap: .4cm; font-family: system-ui, sans-serif; }
.tile { position: relative; width: ${rotated ? ph : pw}; height: ${rotated ? pw : ph}; flex-shrink: 0; break-inside: avoid; }
.tile img { display: block; width: ${pw}; height: ${ph}; object-fit: contain; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
.rotated img { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(90deg); }
.toolbar { width: 100%; text-align: center; padding: 12px; }
button { padding: 10px 24px; cursor: pointer; font: inherit; }
@media print { .toolbar { display: none; } }
@media screen { html, body { width: 100%; min-height: 100vh; } }
</style></head><body>
${temporary ? '<div class="toolbar"><button id="print">Imprimir</button><p>Link disponível por 6 horas após a criação.</p></div>' : ''}
${items}
<script src="/lib/print-actions.js" defer></script>
</body></html>`;
}
