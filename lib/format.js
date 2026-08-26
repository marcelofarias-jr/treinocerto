/*
 * Formatação de duração. Antes existiam quatro implementações espalhadas
 * (treino, Header, index, stats) com três formatos diferentes — um treino de
 * 1h01min aparecia como 61:40, 1:01:40 e 1h 01min na mesma sessão.
 *
 *   'clock' → cronômetro: MM:SS, ou H:MM:SS a partir de uma hora
 *   'short' → leitura: 45min, ou 1h 05min a partir de uma hora
 */
export function formatDuration(seconds, style = 'clock') {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60

  if (style === 'short') {
    return h > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${m}min`
  }
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
