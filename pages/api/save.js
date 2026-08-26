import { requireUser } from '../../lib/apiAuth'
import supabase from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireUser(req, res)
  if (!user) return

  const { format, days } = req.body
  if (typeof format !== 'string' || !format) return res.status(400).json({ error: 'format obrigatório' })
  if (!Array.isArray(days)) return res.status(400).json({ error: 'days deve ser uma lista' })

  const { data, error } = await supabase
    .from('workouts')
    .insert({
      user_email: user.email,
      format,
      days,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) { console.error('save POST:', error.message); return res.status(500).json({ error: error.message }) }
  res.status(200).json({ ok: true, id: data.id })
}
