import { todayFortaleza, addDays } from './dates'

/*
 * Regras de leitura do treino, num lugar só.
 *
 * Estavam duplicadas entre index, stats, my-workouts e treino — e a duplicação
 * já custou: o filtro por workoutId na recomendação do dia precisou ser
 * aplicado em dois arquivos separados para as telas não discordarem.
 */

// Dias consecutivos treinados terminando hoje (ou ontem, para não zerar a
// sequência antes de o dia acabar).
export function calcStreak(sessions) {
  const dateSet = new Set((sessions || []).map(s => s.date))
  const today = todayFortaleza()
  const yesterday = addDays(today, -1)

  const start = dateSet.has(today) ? today : dateSet.has(yesterday) ? yesterday : null
  if (!start) return 0

  let streak = 0
  let cur = start
  while (dateSet.has(cur)) {
    streak++
    cur = addDays(cur, -1)
  }
  return streak
}

// Maior sequência de dias consecutivos em todo o histórico.
export function calcBestStreak(sessions) {
  const dates = [...new Set((sessions || []).map(s => s.date))].sort()
  let best = 0
  let run = 0
  let prev = null
  for (const d of dates) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1
    if (run > best) best = run
    prev = d
  }
  return best
}

/*
 * Próximo dia do ciclo: o seguinte ao último treinado DESTE plano.
 *
 * O filtro por workoutId é essencial — dayIds se repetem entre planos (A/B/C),
 * então sem ele uma sessão de outro treino (o Full Body do sábado, por exemplo)
 * desloca a rotação do plano ativo.
 */
export function recommendedDay(workout, sessions) {
  if (!workout?.days?.length) return null

  const own = (sessions || []).filter(s => String(s.workoutId) === String(workout.id))
  const sorted = [...own].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id)
  const lastWithDay = sorted.find(s => s.dayId)

  if (!lastWithDay) return workout.days[0] || null

  const lastIdx = workout.days.findIndex(d => d.dayId === lastWithDay.dayId)
  if (lastIdx === -1) return workout.days[0] || null
  return workout.days[(lastIdx + 1) % workout.days.length] || null
}

// Exercícios de um dia (os blocos são agrupados por músculo).
export function countExercises(day) {
  return (day?.exercises || []).reduce((total, block) => total + (block.exercises || []).length, 0)
}

// Séries planejadas de um dia. Exercício sem `series` definido conta 3, e um
// valor inválido também cai para 3 em vez de virar NaN e envenenar o total.
export function countSeriesInDay(day) {
  return (day?.exercises || []).reduce((total, block) =>
    total + (block.exercises || []).reduce((sum, ex) => {
      const n = typeof ex === 'object' && ex?.series ? parseInt(ex.series, 10) : NaN
      return sum + (Number.isFinite(n) && n > 0 ? n : 3)
    }, 0), 0)
}

// Séries planejadas do plano inteiro.
export function countSeries(days) {
  return (days || []).reduce((total, day) => total + countSeriesInDay(day), 0)
}
