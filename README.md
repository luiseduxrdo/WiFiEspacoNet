# Gerador de QR Wi-Fi — EspaçoNet

Ferramenta interna para gerar QR codes e cards Wi-Fi prontos para impressão/envio ao cliente.
Funciona 100% no navegador. Nenhum dado é enviado ou armazenado.

---

## Funcionalidades

- Suporte a **WPA/WPA2/WPA3 Personal**, **WEP**, **Aberta** e **WPA2-EAP (Enterprise)**
- Toggle de **rede oculta**
- **Preview em tempo real** (WYSIWYG)
- Download de:
  - `combo.png` — QR grande + card num único arquivo
  - `card.png`  — somente o card impresso
  - `qr.png`    — somente o QR code
- **Imprimir** direto do navegador
- Qualidade Normal (3×) ou Alta (4×) para exportação
- Zero retenção: recarregar a página apaga tudo

---

## Estrutura de arquivos

```
Wi-Fi Generator/
├── index.html             ← página principal
├── style.css              ← estilos
├── app.js                 ← lógica da aplicação
├── assets/
│   ├── logo_espaconet.png ← logo EspaçoNet
│   └── wifi.png           ← ícone Wi-Fi do card
├── lib/
│   └── qrcode.min.js      ← biblioteca QR (local, offline)
└── README.md
```

---

## Como usar localmente

Abra `index.html` diretamente no navegador **ou** sirva via servidor local:

```bash
# Python 3
python -m http.server 8080

# Node.js (npx)
npx serve .
```

Acesse `http://localhost:8080`.

> **Nota:** abrir o `index.html` diretamente como `file://` pode bloquear o carregamento das imagens dos assets em alguns navegadores. Use um servidor local para garantir o funcionamento completo.

---

## Padrão do payload Wi-Fi QR (ZXing)

| Tipo          | Formato                                                              |
|---------------|----------------------------------------------------------------------|
| WPA/WPA2/WPA3 | `WIFI:T:WPA;S:<ssid>;P:<senha>;H:<true/false>;;`                     |
| WEP           | `WIFI:T:WEP;S:<ssid>;P:<senha>;H:<true/false>;;`                     |
| Aberta        | `WIFI:T:nopass;S:<ssid>;H:<true/false>;;`                            |
| Enterprise    | `WIFI:T:WPA2-EAP;S:<ssid>;E:<eap>;I:<id>;P:<senha>;H:<true/false>;;` |

Caracteres especiais escapados com `\`: `\ ; , " :`

---

## Dependências

| Pacote            | Versão | Uso               | Licença |
|-------------------|--------|-------------------|---------|
| qrcode-generator  | 1.4.4  | Geração do QR code | MIT     |

A biblioteca está incluída em `lib/qrcode.min.js` — não requer internet após o carregamento inicial.
