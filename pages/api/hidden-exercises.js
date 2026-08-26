import supabase from '../../lib/supabase'
import { requireUser, requireAdmin } from '../../lib/apiAuth'
import { parseText } from '../../lib/validate'

// hidden_exercises é uma tabela GLOBAL: ocultar um exercício aqui o esconde do
// catálogo de todos os usuários. Leitura é livre para quem está logado (o
// montador de treino precisa dela); escrita é só do admin.
export default async function handler(req, res) {
  if (req.method === 'GET') {
    const user = await requireUser(req, res)
    if (!user) return

    const { data, error } = await supabase
      .from('hidden_exercises')
      .select('name, muscle_group')
    if (error) { console.error('hidden-exercises GET:', error.message); return res.status(500).json({ error: error.message }) }
    return res.status(200).json(data || [])
  }

  if (req.method === 'POST') {
    const admin = await requireAdmin(req, res)
    if (!admin) return

    const name = parseText(req.body?.name, 80)
    const muscleGroup = parseText(req.body?.muscleGroup, 40)
    if (!name || !muscleGroup) return res.status(400).json({ error: 'name e muscleGroup obrigatórios' })

    const { error } = await supabase
      .from('hidden_exercises')
      .upsert({ name, muscle_group: muscleGroup })
    if (error) { console.error('hidden-exercises POST:', error.message); return res.status(500).json({ error: error.message }) }
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const admin = await requireAdmin(req, res)
    if (!admin) return

    const name = parseText(req.body?.name, 80)
    if (!name) return res.status(400).json({ error: 'Missing name' })

    const { error } = await supabase
      .from('hidden_exercises')
      .delete()
      .eq('name', name)
    if (error) { console.error('hidden-exercises DELETE:', error.message); return res.status(500).json({ error: error.message }) }
    return res.status(200).json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
