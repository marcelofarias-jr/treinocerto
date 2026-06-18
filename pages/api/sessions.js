import supabase from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { email } = req.query
    if (!email) return res.status(400).json({ error: 'Email required' })

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_email', email)
      .order('date', { ascending: true })

    if (error) { console.error('sessions GET:', error.message); return res.status(500).json({ error: error.message }) }
    return res.status(200).json(data.map(normalizeSession))
  }

  if (req.method === 'POST') {
    const { userEmail, date, workoutId, dayId, dayLabel, duration, exercisesData, notes } = req.body
    if (!userEmail || !date) return res.status(400).json({ error: 'userEmail and date required' })

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        id: Date.now(),
        user_email: userEmail,
        date,
        workout_id: workoutId,
        day_id: dayId,
        day_label: dayLabel,
        duration: duration || 0,
        exercises_data: exercisesData || [],
        notes: notes || null,
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(normalizeSession(data))
  }

  res.status(405).json({ error: 'Method not allowed' })
}

function normalizeSession(row) {
  return {
    id: row.id,
    userEmail: row.user_email,
    date: row.date,
    workoutId: row.workout_id,
    dayId: row.day_id,
    dayLabel: row.day_label,
    duration: row.duration,
    exercisesData: row.exercises_data || [],
    notes: row.notes || null,
  }
}
