# Gerador de QR Wi-Fi — EspaçoNet

Ferramenta interna para gerar QR codes e cards Wi-Fi prontos para impressão/envio ao cliente.
Gera os cartões no navegador e usa Neon/PostgreSQL para o histórico e os links temporários de impressão.

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
- Links temporários para compartilhar a impressão, válidos por 6 horas

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

## Links temporários de impressão

Depois de gerar os cartões, clique em **Link Temporário**, ao lado de **Imprimir**.
Use **Copiar link** para compartilhar ou **Abrir impressão** para conferir. O link
preserva os cartões, o tamanho, a orientação e a quantidade de cópias selecionados.
Quem receber o link pode abrir e imprimir sem baixar um arquivo.

O banco guarda uma cópia dos cartões, que contém os dados Wi-Fi visíveis, e apenas
o hash de um token aleatório de 256 bits. O endereço dá acesso aos cartões durante
6 horas a partir da criação. Depois desse prazo, a API recusa o acesso, mesmo que
a limpeza ainda não tenha executado. Uma página já aberta ou uma impressão já
salva não pode ser revogada.

### Banco e limpeza automática

- Configure `DATABASE_URL` no ambiente das funções Vercel.
- Para uma instalação existente, execute `npm run db:migrate-links` com a variável
  em `.env.local`. A mesma migração está em `db/temporary-links.sql` e no endpoint
  de migração existente. Novas instalações podem executar `db/schema.sql`.
- Configure o secret `DATABASE_URL` no GitHub Actions do repositório.
- Publique `.github/workflows/cleanup-print-links.yml` e os scripts na branch padrão.
  O workflow exclui os registros expirados uma vez por dia, às 03:00 no horário de
  Fortaleza (06:00 UTC), e também aceita execução
  manual. O GitHub pode atrasar execuções agendadas; a validade do acesso continua
  sendo de exatamente 6 horas. Acompanhe a execução em Actions.
- Para executar a limpeza manualmente: `npm run db:cleanup-links`.

Os endpoints são `POST /api/temporary-links` e `GET /api/temporary-links/:token`.
O primeiro aceita até quatro imagens PNG, com payload total de até 3 MiB.
As respostas de impressão desabilitam cache e indexação por mecanismos de busca.

### Verificação

`npm test` verifica validação, tokens e montagem da impressão. Para incluir o
teste de criação, leitura, expiração e exclusão no banco, disponibilize
`TEST_DATABASE_URL` e execute `npm test`. Esse teste cria um registro próprio e
executa a rotina de limpeza de links expirados.
