# TreinoCerto — Frontend Next.js

Projeto mínimo em Next.js com autenticação Google (NextAuth), Tailwind e seleção de formato/exercícios para montar treinos de hipertrofia.

Requisitos:
- Node.js 18+

Instalação:

```bash
cd /home/lit07/treinocerto
npm install
```

Variáveis de ambiente necessárias (crie um arquivo `.env.local`):

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_URL` (ex: http://localhost:3000)

Rodar em desenvolvimento:

```bash
npm run dev
```

Observações:
- A rota `/api/save` grava em `data/trainings.json` para demonstração local. Em ambientes serverless reais, use um banco de dados.
