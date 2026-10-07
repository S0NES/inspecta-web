# inspecta-web

Frontend do Inspecta: o painel que imobiliárias, administradores e vistoriadores usam para abrir solicitações, acompanhar vistorias, ver laudos e conferir extratos. É React 18 com TypeScript e Vite, e conversa só com a [inspecta-api](https://github.com/S0NES/inspecta-api).

## Rodando

```bash
npm install
npm run dev        # http://localhost:5173
```

A API é lida de `VITE_API_BASE_URL` (padrão `http://localhost:8080`). Para mudar, crie um `.env.local` com essa variável. Só variáveis com prefixo `VITE_` chegam ao navegador.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | gera `dist/`, pronto para servir como estático |
| `npm run test:run` | roda os testes (Vitest) uma vez |
| `npx tsc --noEmit` | checagem de tipos |

Se o Vitest ficar instável com a máquina ocupada, rode `npx vitest run --no-file-parallelism`.

## Organização

- `src/pages`: uma pasta por tela
- `src/components`: componentes compartilhados (tabelas, formulários, layout)
- `src/api`: chamadas à API, uma por recurso
- `src/styles/tokens.css`: cores, espaçamentos e tipografia
- `src/i18n/pt-BR.json`: todos os textos da interface

## Deploy

O build é estático. Em produção ele roda atrás do Nginx (veja `Dockerfile` e `nginx.conf`) ou em qualquer hospedagem de estáticos, com `VITE_API_BASE_URL` apontando para a API real. A API precisa liberar a origem do front em `CORS_ALLOWED_ORIGINS`.
