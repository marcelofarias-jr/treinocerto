import supabase from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { email } = req.query
    if (!email) return res.status(400).json({ error: 'Email required' })

    const { data, error } = await supabase
      .from('custom_exercises')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(
      (data || []).map(r => ({ id: r.id, muscleGroup: r.muscle_group, name: r.name }))
    )
  }

  if (req.method === 'POST') {
    const { userEmail, muscleGroup, name } = req.body
    if (!userEmail || !muscleGroup || !name) return res.status(400).json({ error: 'Missing fields' })

    const { data, error } = await supabase
      .from('custom_exercises')
      .insert({ id: Date.now(), user_email: userEmail, muscle_group: muscleGroup, name: name.trim() })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ id: data.id, muscleGroup: data.muscle_group, name: data.name })
  }

  if (req.method === 'PATCH') {
    const { id, name } = req.body
    if (!id || !name) return res.status(400).json({ error: 'Missing fields' })

    const { data, error } = await supabase
      .from('custom_exercises')
      .update({ name: name.trim() })
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ id: data.id, muscleGroup: data.muscle_group, name: data.name })
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'Missing id' })

    const { error } = await supabase
      .from('custom_exercises')
      .delete()
      .eq('id', id)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
