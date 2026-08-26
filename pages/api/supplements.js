import supabase from '../../lib/supabase'
import { requireUser } from '../../lib/apiAuth'
import { isValidDate, parseText } from '../../lib/validate'

// Registro de suplementos por dia. A existência de uma linha (user, date, name)
// significa que o suplemento foi tomado naquele dia.
export default async function handler(req, res) {
  const user = await requireUser(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const { from, to } = req.query
    if (from && !isValidDate(from)) return res.status(400).json({ error: 'from inválido' })
    if (to && !isValidDate(to)) return res.status(400).json({ error: 'to inválido' })

    let query = supabase
      .from('supplement_logs')
      .select('id, date, name')
      .eq('user_email', user.email)
      .order('date', { ascending: false })

    if (from) query = query.gte('date', from)
    if (to) query = query.lte('date', to)

    const { data, error } = await query
    if (error) { console.error('supplements GET:', error.message); return res.status(500).json({ error: error.message }) }
    return res.status(200).json(data || [])
  }

  if (req.method === 'POST') {
    const { date } = req.body
    const name = parseText(req.body?.name, 60)
    if (!isValidDate(date)) return res.status(400).json({ error: 'date deve estar no formato YYYY-MM-DD' })
    if (!name) return res.status(400).json({ error: 'name obrigatório' })

    // Idempotente: se já existir, apenas retorna o registro.
    const { data: existing } = await supabase
      .from('supplement_logs')
      .select('id, date, name')
      .eq('user_email', user.email)
      .eq('date', date)
      .eq('name', name)
      .maybeSingle()

    if (existing) return res.status(200).json({ ...existing, taken: true })

    const { data, error } = await supabase
      .from('supplement_logs')
      .insert({ user_email: user.email, date, name })
      .select('id, date, name')
      .single()

    if (error) { console.error('supplements POST:', error.message); return res.status(500).json({ error: error.message }) }
    return res.status(200).json({ ...data, taken: true })
  }

  if (req.method === 'DELETE') {
    const { date } = req.query
    const name = parseText(req.query?.name, 60)
    if (!isValidDate(date)) return res.status(400).json({ error: 'date inválido' })
    if (!name) return res.status(400).json({ error: 'name obrigatório' })

    const { error } = await supabase
      .from('supplement_logs')
      .delete()
      .eq('user_email', user.email)
      .eq('date', date)
      .eq('name', name)

    if (error) { console.error('supplements DELETE:', error.message); return res.status(500).json({ error: error.message }) }
    return res.status(200).json({ success: true, taken: false })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
