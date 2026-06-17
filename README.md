# TreinoCerto

Aplicativo de acompanhamento de treinos feito para uso no celular. Permite montar fichas personalizadas, registrar séries e cargas durante o treino, acompanhar recordes pessoais e visualizar estatísticas de evolução.

## Funcionalidades

- **Montagem de ficha** — escolha o formato (Full Body, Upper/Lower, PPL, ABC, ABCD, ABCDE) e personalize os exercícios por grupo muscular
- **Execução do treino** — cronômetro persistente que não para ao sair da tela ou bloquear o celular, timer de descanso com alerta sonoro e vibração
- **Histórico e recordes** — pré-preenchimento com os dados do último treino e exibição do PR por exercício
- **Estatísticas** — treinos realizados, sequência (streak), peso total levantado, frequência semanal, grupos musculares mais treinados e recordes por exercício
- **Calendário** — visualização dos dias treinados com detalhes de cada sessão
- **Cancelar treino** — descarte sem salvar, com confirmação antes de perder os dados
- **Mobile-first** — bottom navigation, safe area do celular, layout responsivo

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 13 (Pages Router) |
| Estilização | Tailwind CSS |
| Autenticação | NextAuth.js v4 + Google OAuth |
| Banco de dados | Supabase (PostgreSQL + JSONB) |
| Deploy | Vercel |
| Fontes | Barlow Condensed + Inter |

## Estrutura de páginas

```
/              → Home com calendário de sessões
/dashboard     → Montagem e edição de fichas
/my-workouts   → Lista de fichas salvas
/treino        → Execução do treino
/stats         → Estatísticas e evolução
```

## Configuração local

### Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com)
- OAuth configurado no [Google Cloud Console](https://console.cloud.google.com)

### 1. Clone e instale

```bash
git clone https://github.com/marcelofarias-jr/treinocerto.git
cd treinocerto
npm install
```

### 2. Variáveis de ambiente

Crie `.env.local` na raiz do projeto:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=          # gere com: openssl rand -base64 32

GOOGLE_CLIENT_ID=         # console.cloud.google.com → Credenciais → OAuth 2.0
GOOGLE_CLIENT_SECRET=

SUPABASE_URL=             # supabase.com → Project Settings → API → Project URL
SUPABASE_SERVICE_ROLE_KEY= # supabase.com → Project Settings → API → service_role (JWT)
```

### 3. Banco de dados

Execute no **SQL Editor** do Supabase:

```sql
CREATE TABLE IF NOT EXISTS workouts (
  id BIGINT PRIMARY KEY,
  user_email TEXT NOT NULL,
  format TEXT NOT NULL,
  days JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_workouts_user_email ON workouts(user_email);

CREATE TABLE IF NOT EXISTS sessions (
  id BIGINT PRIMARY KEY,
  user_email TEXT NOT NULL,
  date TEXT NOT NULL,
  workout_id BIGINT,
  day_id TEXT,
  day_label TEXT,
  duration INT DEFAULT 0,
  exercises_data JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_email ON sessions(user_email);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(user_email, date);
```

### 4. Google OAuth

No Google Cloud Console, adicione em **Authorized redirect URIs**:

```
http://localhost:3000/api/auth/callback/google
https://seu-dominio.vercel.app/api/auth/callback/google
```

### 5. Rode o projeto

```bash
npm run dev
```

Acesse `http://localhost:3000`

## Deploy na Vercel

1. Importe o repositório em [vercel.com](https://vercel.com)
2. Adicione as variáveis de ambiente nas configurações do projeto (`NEXTAUTH_URL` deve apontar para a URL de produção)
3. Faça o deploy — a Vercel detecta o Next.js automaticamente

## Licença

MIT
