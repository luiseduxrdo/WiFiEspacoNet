# Melhorias de Design — WiFiEspacoNet

> Documento de acompanhamento das edições de design.
> Cada bloco será implementado apenas após aprovação.

---

## Bloco 1 — Acessibilidade e Contraste (WCAG AA)

**Prioridade:** Alta | **Esforço:** Baixo | **Status:** Concluido

### O que será feito:
- Escurecer o verde dos botões de `#7AB517` para `#5a8a0f` (texto branco legível)
- Escurecer placeholder dos inputs de `#b0b0b0` para `#8a8a8a`
- Ajustar cor do texto secundário onde necessário
- Garantir ratio mínimo de 4.5:1 em todos os textos

### Arquivos afetados:
- `style.css` (variáveis e regras de cor)

---

## Bloco 2 — Escala Tipográfica e Espaçamento

**Prioridade:** Média | **Esforço:** Médio | **Status:** Concluido

### O que será feito:
- Padronizar tamanhos de fonte em uma escala consistente: `0.75rem`, `0.8125rem`, `0.875rem`, `1rem`, `1.125rem`, `1.25rem`
- Eliminar valores arbitrários (0.73rem, 0.78rem, 0.82rem, 0.83rem, 0.85rem, etc.)
- Padronizar espaçamentos em múltiplos de 4px: `4px`, `8px`, `12px`, `16px`, `24px`, `32px`
- Eliminar valores soltos (6px, 7px, 10px, 11px, 14px, 18px, etc.)

### Arquivos afetados:
- `style.css`

---

## Bloco 3 — Responsividade Aprimorada

**Prioridade:** Alta | **Esforço:** Médio | **Status:** Concluido

### O que será feito:
- Adicionar breakpoint intermediário para tablet (`600px - 1024px`)
- Mudar grid de `420px + 1fr` fixo para layout mais flexível
- Aumentar `max-width` de `1100px` para `1280px` para acomodar 3 colunas
- Ajustar preview e histórico para não ficarem comprimidos entre 860px e 950px
- Melhorar touch targets em mobile (min 44px)

### Arquivos afetados:
- `style.css` (media queries e grid)

---

## Bloco 4 — Hierarquia Visual e Destaque do Preview

**Prioridade:** Média | **Esforço:** Médio | **Status:** Concluido

### O que será feito:
- Adicionar borda sutil colorida (laranja) no card de preview para destaque
- Diferenciar visualmente o botão "Baixar COMBO" das ações secundárias
- Agrupar botões de download com separador visual (primário vs secundários)
- Melhorar estado vazio do preview com ícone ilustrativo
- Melhorar estado vazio do histórico com ícone + texto mais convidativo

### Arquivos afetados:
- `style.css`
- `index.html` (ícones SVG nos estados vazios)

---

## Bloco 5 — Header e Presença de Marca

**Prioridade:** Baixa | **Esforço:** Médio | **Status:** Concluido

### O que será feito:
- Redesign do header com mais presença visual
- Adicionar subtítulo descritivo ("Ferramenta interna")
- Melhorar espaçamento e proporção do logo
- Adicionar gradiente sutil ou background com mais personalidade

### Arquivos afetados:
- `style.css`
- `index.html` (estrutura do header)

---

## Bloco 6 — Microinterações e Estados de Loading

**Prioridade:** Média | **Esforço:** Médio | **Status:** Concluido

### O que será feito:
- Adicionar skeleton loading nos cards ao carregar a página
- Adicionar estado de loading visual nos botões de download (spinner + texto)
- Transição suave ao mostrar/ocultar seção Enterprise
- Melhorar animação do toggle de "Rede oculta"
- Feedback visual ao copiar/baixar (toast de confirmação)

### Arquivos afetados:
- `style.css` (animações e keyframes)
- `app.js` (lógica de estados)
- `index.html` (estrutura do toast)

---

## Bloco 7 — Refinamento da Seção Enterprise

**Prioridade:** Média | **Esforço:** Baixo | **Status:** Concluido

### O que será feito:
- Trocar borda `dashed` por borda `solid` sutil com destaque lateral (left-border colorido)
- Melhorar background da seção (mais integrado ao design)
- Ícone de cadeado no título da seção
- Transição animada ao expandir/recolher

### Arquivos afetados:
- `style.css`
- `index.html` (ícone no título)

---

## Bloco 8 — Performance de Assets

**Prioridade:** Alta | **Esforço:** Baixo | **Status:** Reprovado

### O que será feito:
- Otimizar `wifi.png` (2.9MB atual — alvo: ~100KB)
- Converter imagens para WebP com fallback PNG
- Adicionar `loading="lazy"` nas imagens não-críticas
- Minificar CSS para produção

### Arquivos afetados:
- `assets/wifi.png` (recompressão)
- `index.html` (atributos de loading)
- `style.css` (minificação)

---

## Legenda de Status

| Status | Significado |
|---|---|
| Pendente | Aguardando aprovação |
| Aprovado | Aprovado, aguardando implementação |
| Em andamento | Sendo implementado |
| Concluído | Implementado e revisado |
| Reprovado | Não será implementado |
