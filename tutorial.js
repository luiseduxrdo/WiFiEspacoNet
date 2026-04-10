/* ──────────────────────────────────────────────────────────────────────────
   Tutorial interativo "Como usar?" — EspaçoNet Wi-Fi Generator
   Ativado pelo botão #tutorialBtn no cabeçalho.
   Não abre automaticamente ao carregar a página.
   ────────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  /* ── Definição dos passos ─────────────────────────────────────────────── */
  const STEPS = [
    {
      title: 'Boas-vindas ao Gerador de QR Wi-Fi!',
      desc:  'Vamos te guiar pelos principais recursos em poucos passos. Use os botões abaixo para navegar ou clique em "Pular" a qualquer momento para fechar.',
      target: null,
    },
    {
      title: 'Nome da rede (SSID)',
      desc:  'Digite aqui o nome exato da sua rede Wi-Fi — é o nome que aparece para os dispositivos quando buscam redes disponíveis. Máximo de 32 caracteres.',
      target: '#ssid',
    },
    {
      title: 'Tipo de segurança',
      desc:  'Escolha o protocolo de criptografia da rede. Para a grande maioria dos roteadores modernos, WPA é o padrão correto e o mais seguro — já vem selecionado por padrão.',
      target: '#securityType',
    },
    {
      title: 'Senha da rede',
      desc:  'Informe a senha da rede Wi-Fi. Mínimo de 8 caracteres. Clique no ícone do olho para mostrar ou ocultar a senha enquanto digita.',
      target: '#passwordGroup',
    },
    {
      title: 'Contrato (opcional)',
      desc:  'Vincule o QR a um número de contrato ou cliente. Este campo é opcional, mas facilita encontrar a rede no histórico depois.',
      target: '#contract',
    },
    {
      title: 'Gerar QR Wi-Fi',
      desc:  'Após preencher os campos obrigatórios, clique aqui para gerar o QR Code e salvar automaticamente no banco de dados.',
      target: '#generateBtn',
    },
    {
      title: 'Baixar e Salvar',
      desc:  'Baixe o QR como imagem PNG (completo com card, card separado ou só o QR), ou salve um PDF com múltiplas cópias em tamanho personalizado.',
      target: '.download-actions',
    },
    {
      title: 'Imprimir',
      desc:  'Abre o diálogo de impressão do navegador com as opções de tamanho e orientação já configuradas. Você pode definir o número de cópias e o tamanho antes de imprimir.',
      target: '#printBtn',
    },
    {
      title: 'Histórico / Banco de dados',
      desc:  'Todas as redes geradas ficam salvas aqui em tempo real. Busque por nome ou contrato, carregue no formulário para reutilizar ou edite e exclua registros.',
      target: '.history-column',
    },
  ];

  const TOTAL = STEPS.length;
  const HOLE_PAD = 12; // padding ao redor do elemento destacado (px)

  /* ── Referências DOM ──────────────────────────────────────────────────── */
  const overlay   = document.getElementById('tutorialOverlay');
  const hole      = document.getElementById('tutorialHole');
  const tooltip   = document.getElementById('tutorialTooltip');
  const titleEl   = document.getElementById('tutorialTitle');
  const descEl    = document.getElementById('tutorialDesc');
  const badgeEl   = document.getElementById('tutorialStepBadge');
  const prevBtn   = document.getElementById('tutorialPrevBtn');
  const nextBtn   = document.getElementById('tutorialNextBtn');
  const skipBtn   = document.getElementById('tutorialSkipBtn');
  const triggerBtn = document.getElementById('tutorialBtn');

  let currentStep = 0;
  let resizeTimer = null;

  /* ── Utilitários ──────────────────────────────────────────────────────── */

  /** Retorna o elemento-alvo do passo (ou null para passos sem alvo). */
  function getTarget(step) {
    if (!step.target) return null;
    return document.querySelector(step.target);
  }

  /**
   * Posiciona o balão perto do elemento alvo.
   * Tenta abaixo → acima → esquerda → direita conforme espaço disponível.
   * Para a coluna de histórico (.history-column) prefere esquerda.
   */
  function positionTooltip(targetEl) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tw = tooltip.offsetWidth  || 310;
    const th = tooltip.offsetHeight || 180;
    const MARGIN = 14; // distância entre o elemento e o balão

    if (!targetEl) {
      // Passo de boas-vindas: centraliza
      tooltip.style.left = Math.max(16, (vw - tw) / 2) + 'px';
      tooltip.style.top  = Math.max(16, (vh - th) / 2) + 'px';
      return;
    }

    const r = targetEl.getBoundingClientRect();

    // Espaço disponível em cada direção
    const spaceBelow = vh - r.bottom - MARGIN;
    const spaceAbove = r.top - MARGIN;
    const spaceLeft  = r.left - MARGIN;

    // Para a coluna de histórico prefere à esquerda (está na borda direita)
    const preferLeft = targetEl.classList.contains('history-column') && spaceLeft > tw + 16;

    let left, top;

    if (preferLeft) {
      left = r.left - tw - MARGIN;
      top  = r.top + (r.height / 2) - (th / 2);
    } else if (spaceBelow >= th + 8) {
      // Abaixo
      top  = r.bottom + MARGIN;
      left = r.left + (r.width / 2) - (tw / 2);
    } else if (spaceAbove >= th + 8) {
      // Acima
      top  = r.top - th - MARGIN;
      left = r.left + (r.width / 2) - (tw / 2);
    } else if (spaceLeft >= tw + 8) {
      // Esquerda
      left = r.left - tw - MARGIN;
      top  = r.top + (r.height / 2) - (th / 2);
    } else {
      // Fallback: abaixo mesmo sem espaço ideal
      top  = r.bottom + MARGIN;
      left = r.left + (r.width / 2) - (tw / 2);
    }

    // Clamp dentro do viewport com margem de 12px
    left = Math.max(12, Math.min(left, vw - tw - 12));
    top  = Math.max(12, Math.min(top,  vh - th - 12));

    tooltip.style.left = left + 'px';
    tooltip.style.top  = top  + 'px';
  }

  /** Atualiza a posição e tamanho do recorte SVG. */
  function updateHole(targetEl) {
    if (!targetEl) {
      // Sem alvo: colapsa o recorte para que a tela fique totalmente escurecida
      hole.setAttribute('x', 0);
      hole.setAttribute('y', 0);
      hole.setAttribute('width', 0);
      hole.setAttribute('height', 0);
      return;
    }

    const r = targetEl.getBoundingClientRect();
    hole.setAttribute('x',      r.left   - HOLE_PAD);
    hole.setAttribute('y',      r.top    - HOLE_PAD);
    hole.setAttribute('width',  r.width  + HOLE_PAD * 2);
    hole.setAttribute('height', r.height + HOLE_PAD * 2);
  }

  /* ── Navegação ────────────────────────────────────────────────────────── */

  function goToStep(index) {
    const step = STEPS[index];
    currentStep = index;

    // Atualiza textos
    titleEl.textContent = step.title;
    descEl.textContent  = step.desc;
    badgeEl.textContent = (index + 1) + ' / ' + TOTAL;

    // Botão Anterior: oculto no primeiro passo
    prevBtn.classList.toggle('is-hidden', index === 0);

    // Botão Próximo: "Concluir" no último passo
    nextBtn.textContent = index === TOTAL - 1 ? 'Concluir ✓' : 'Próximo →';

    // Fade-out do balão antes de reposicionar
    tooltip.classList.remove('is-visible');

    const targetEl = getTarget(step);

    const apply = () => {
      updateHole(targetEl);
      positionTooltip(targetEl);
      // Pequeno delay para deixar o reposicionamento acontecer antes do fade-in
      setTimeout(() => tooltip.classList.add('is-visible'), 60);
    };

    if (targetEl) {
      // Scroll suave até o elemento, depois aplica highlight
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      setTimeout(apply, 200);
    } else {
      apply();
    }
  }

  /* ── Abrir / fechar ───────────────────────────────────────────────────── */

  function openTutorial() {
    overlay.classList.add('is-active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    goToStep(0);
  }

  function closeTutorial() {
    tooltip.classList.remove('is-visible');
    setTimeout(() => {
      overlay.classList.remove('is-active');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      // Colapsa o recorte
      hole.setAttribute('width', 0);
      hole.setAttribute('height', 0);
    }, 200);
  }

  /* ── Event listeners ──────────────────────────────────────────────────── */

  if (triggerBtn) {
    triggerBtn.addEventListener('click', openTutorial);
  }

  nextBtn.addEventListener('click', () => {
    if (currentStep < TOTAL - 1) {
      goToStep(currentStep + 1);
    } else {
      closeTutorial();
    }
  });

  prevBtn.addEventListener('click', () => {
    if (currentStep > 0) goToStep(currentStep - 1);
  });

  skipBtn.addEventListener('click', closeTutorial);

  // Fechar ao pressionar Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('is-active')) {
      closeTutorial();
    }
  });

  // Reposicionar ao redimensionar a janela (debounced)
  window.addEventListener('resize', () => {
    if (!overlay.classList.contains('is-active')) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => goToStep(currentStep), 120);
  });

})();
