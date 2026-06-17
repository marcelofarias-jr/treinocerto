-- Tabela de treinos
CREATE TABLE IF NOT EXISTS workouts (
  id BIGINT PRIMARY KEY,
  user_email TEXT NOT NULL,
  format TEXT NOT NULL,
  days JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workouts_user_email ON workouts(user_email);

-- Tabela de sessões de treino
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
