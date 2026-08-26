import supabase from '../../lib/supabase'
import { requireUser } from '../../lib/apiAuth'
import { parseText } from '../../lib/validate'

export default async function handler(req, res) {
  const user = await requireUser(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('custom_exercises')
      .select('*')
      .eq('user_email', user.email)
      .order('created_at', { ascending: true })

    if (error) { console.error('exercises GET:', error.message); return res.status(500).json({ error: error.message }) }
    return res.status(200).json(
      (data || []).map(r => ({ id: r.id, muscleGroup: r.muscle_group, name: r.name }))
    )
  }

  if (req.method === 'POST') {
    const { muscleGroup, name } = req.body
    const cleanName = parseText(name, 80)
    const cleanGroup = parseText(muscleGroup, 40)
    if (!cleanName || !cleanGroup) return res.status(400).json({ error: 'muscleGroup e name obrigatórios' })

    const { data, error } = await supabase
      .from('custom_exercises')
      .insert({ user_email: user.email, muscle_group: cleanGroup, name: cleanName })
      .select()
      .single()

    if (error) { console.error('exercises POST:', error.message); return res.status(500).json({ error: error.message }) }
    return res.status(200).json({ id: data.id, muscleGroup: data.muscle_group, name: data.name })
  }

  if (req.method === 'PATCH') {
    const { id, name } = req.body
    const cleanName = parseText(name, 80)
    if (!id || !cleanName) return res.status(400).json({ error: 'id e name obrigatórios' })

    // Escopo por dono: sem isso, qualquer id renomearia o exercício de outro.
    const { data, error } = await supabase
      .from('custom_exercises')
      .update({ name: cleanName })
      .eq('id', id)
      .eq('user_email', user.email)
      .select()

    if (error) { console.error('exercises PATCH:', error.message); return res.status(500).json({ error: error.message }) }
    if (!data?.length) return res.status(404).json({ error: 'Exercício não encontrado' })
    return res.status(200).json({ id: data[0].id, muscleGroup: data[0].muscle_group, name: data[0].name })
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'Missing id' })

    const { data, error } = await supabase
      .from('custom_exercises')
      .delete()
      .eq('id', id)
      .eq('user_email', user.email)
      .select('id')

    if (error) { console.error('exercises DELETE:', error.message); return res.status(500).json({ error: error.message }) }
    if (!data?.length) return res.status(404).json({ error: 'Exercício não encontrado' })
    return res.status(200).json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
