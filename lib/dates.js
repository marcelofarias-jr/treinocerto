// Utilitários de data no fuso de Fortaleza (America/Fortaleza, UTC-3, sem horário de verão).
// Todas as datas de sessão/peso são armazenadas e comparadas como strings YYYY-MM-DD
// referentes ao dia civil em Fortaleza, evitando o deslocamento causado por toISOString() (UTC).

const TZ = 'America/Fortaleza'

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

// Data civil (YYYY-MM-DD) em Fortaleza para o instante informado (padrão: agora).
export function todayFortaleza(base = new Date()) {
  return dateFmt.format(base)
}

// Converte um Date para YYYY-MM-DD usando os campos locais (sem passar por UTC).
function isoDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Segunda-feira da semana que contém dateStr (YYYY-MM-DD).
export function startOfWeek(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()               // 0=Dom … 6=Sáb
  const diff = day === 0 ? 6 : day - 1 // dias desde a segunda
  d.setDate(d.getDate() - diff)
  return isoDate(d)
}

// Domingo da semana que contém dateStr (YYYY-MM-DD).
export function endOfWeek(dateStr) {
  const d = new Date(startOfWeek(dateStr) + 'T12:00:00')
  d.setDate(d.getDate() + 6)
  return isoDate(d)
}

// Primeiro dia do mês que contém dateStr (YYYY-MM-DD).
export function startOfMonth(dateStr) {
  return dateStr.slice(0, 7) + '-01'
}

// Último dia do mês que contém dateStr (YYYY-MM-DD).
export function endOfMonth(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setMonth(d.getMonth() + 1, 0) // dia 0 do mês seguinte = último dia deste mês
  return isoDate(d)
}

// Adiciona (ou subtrai) dias a dateStr, retornando YYYY-MM-DD.
export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

// Adiciona (ou subtrai) meses a dateStr, retornando YYYY-MM-DD.
// Normaliza para o dia 1 antes de deslocar, evitando o "estouro" de dias
// (ex.: 31/jan + 1 mês virar 03/mar em vez de fevereiro).
export function addMonths(dateStr, n) {
  const d = new Date(startOfMonth(dateStr) + 'T12:00:00')
  d.setMonth(d.getMonth() + n)
  return isoDate(d)
}
