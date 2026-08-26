import supabase from '../../lib/supabase'
import { requireUser } from '../../lib/apiAuth'
import { isValidDate } from '../../lib/validate'

export default async function handler(req, res) {
  const user = await requireUser(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_email', user.email)
      .order('date', { ascending: true })

    if (error) { console.error('sessions GET:', error.message); return res.status(500).json({ error: error.message }) }
    return res.status(200).json(data.map(normalizeSession))
  }

  if (req.method === 'POST') {
    const { date, workoutId, dayId, dayLabel, duration, exercisesData, notes } = req.body
    if (!isValidDate(date)) return res.status(400).json({ error: 'date deve estar no formato YYYY-MM-DD' })
    if (exercisesData != null && !Array.isArray(exercisesData)) {
      return res.status(400).json({ error: 'exercisesData deve ser uma lista' })
    }

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        user_email: user.email,
        date,
        workout_id: workoutId ?? null,
        day_id: dayId ?? null,
        day_label: typeof dayLabel === 'string' ? dayLabel.slice(0, 120) : null,
        duration: clampDuration(duration),
        exercises_data: exercisesData || [],
        notes: typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 2000) : null,
      })
      .select()
      .single()

    if (error) { console.error('sessions POST:', error.message); return res.status(500).json({ error: error.message }) }
    return res.status(200).json(normalizeSession(data))
  }

  if (req.method === 'PUT') {
    // Corrige uma sessão já gravada: cargas, repetições e anotação.
    // Data, dia e duração ficam como estão — o que se erra é o número digitado.
    const { id, exercisesData, notes } = req.body
    if (!id) return res.status(400).json({ error: 'id obrigatório' })
    if (!Array.isArray(exercisesData)) return res.status(400).json({ error: 'exercisesData deve ser uma lista' })
    if (!isValidExercisesData(exercisesData)) return res.status(400).json({ error: 'exercisesData inválido' })

    const { data, error } = await supabase
      .from('sessions')
      .update({
        exercises_data: exercisesData,
        notes: typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 2000) : null,
      })
      .eq('id', id)
      .eq('user_email', user.email)
      .select()

    if (error) { console.error('sessions PUT:', error.message); return res.status(500).json({ error: error.message }) }
    if (!data?.length) return res.status(404).json({ error: 'Sessão não encontrada' })
    return res.status(200).json(normalizeSession(data[0]))
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id obrigatório' })

    const { data, error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', id)
      .eq('user_email', user.email)
      .select('id')

    if (error) { console.error('sessions DELETE:', error.message); return res.status(500).json({ error: error.message }) }
    if (!data?.length) return res.status(404).json({ error: 'Sessão não encontrada' })
    return res.status(200).json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}

// Forma esperada: [{ name, muscleGroup, sets: [{ carga, repeticoes, done }] }]
function isValidExercisesData(list) {
  return list.every(e =>
    e && typeof e === 'object' &&
    typeof e.name === 'string' && e.name.length > 0 && e.name.length <= 120 &&
    Array.isArray(e.sets) &&
    e.sets.every(set => set && typeof set === 'object')
  )
}

// Duração em segundos: 0 a 24h. Protege contra relógio adiantado do cliente.
function clampDuration(value) {
  const n = parseInt(value, 10)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(n, 86400)
}

function normalizeSession(row) {
  return {
    id: row.id,
    date: row.date,
    workoutId: row.workout_id,
    dayId: row.day_id,
    dayLabel: row.day_label,
    duration: row.duration,
    exercisesData: row.exercises_data || [],
    notes: row.notes || null,
  }
}
