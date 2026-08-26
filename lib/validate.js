// Validações compartilhadas pelas rotas de API. Como o cliente Supabase usa a
// service_role key (que ignora RLS) e o schema não tem constraints, a rota é a
// única camada que pode recusar entrada malformada.

// Data civil no formato YYYY-MM-DD, e que exista de fato no calendário.
export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

// Número dentro de uma faixa. Retorna null quando inválido.
export function parseNumberInRange(value, min, max) {
  const n = parseFloat(value)
  if (!Number.isFinite(n) || n < min || n > max) return null
  return n
}

// Texto obrigatório com limite de tamanho. Retorna null quando inválido.
export function parseText(value, maxLength) {
  if (typeof value !== 'string') return null
  const t = value.trim()
  if (!t || t.length > maxLength) return null
  return t
}
