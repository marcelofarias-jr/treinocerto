import supabase from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { email } = req.query
    if (!email) return res.status(400).json({ error: 'Email required' })

    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: true })

    if (error) { console.error('workouts GET:', error.message); return res.status(500).json({ error: error.message }) }

    return res.status(200).json(data.map(normalizeWorkout))
  }

  if (req.method === 'PUT') {
    const { id, format, days, user } = req.body
    if (!id) return res.status(400).json({ error: 'ID required' })

    const { data, error } = await supabase
      .from('workouts')
      .update({ format, days, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(normalizeWorkout(data))
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'ID required' })

    const { error } = await supabase.from('workouts').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}

function normalizeWorkout(row) {
  return {
    id: row.id,
    format: row.format,
    days: row.days,
    user: { email: row.user_email },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
