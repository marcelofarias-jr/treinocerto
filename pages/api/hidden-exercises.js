import supabase from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('hidden_exercises')
      .select('name, muscle_group')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data || [])
  }

  if (req.method === 'POST') {
    const { name, muscleGroup } = req.body
    if (!name || !muscleGroup) return res.status(400).json({ error: 'Missing fields' })
    const { error } = await supabase
      .from('hidden_exercises')
      .upsert({ name, muscle_group: muscleGroup })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { name } = req.body
    if (!name) return res.status(400).json({ error: 'Missing name' })
    const { error } = await supabase
      .from('hidden_exercises')
      .delete()
      .eq('name', name)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
