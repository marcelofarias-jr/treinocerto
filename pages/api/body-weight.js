import supabase from '../../lib/supabase'
import { requireUser } from '../../lib/apiAuth'
import { isValidDate, parseNumberInRange } from '../../lib/validate'

export default async function handler(req, res) {
  const user = await requireUser(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const { last } = req.query

    let query = supabase
      .from('body_weight')
      .select('id, date, weight')
      .eq('user_email', user.email)
      .order('date', { ascending: last ? false : true })

    if (last) query = query.limit(1)

    const { data, error } = await query
    if (error) { console.error('body-weight GET:', error.message); return res.status(500).json({ error: error.message }) }

    const result = (data || []).map(r => ({ id: r.id, date: r.date, weight: parseFloat(r.weight) }))
    return res.status(200).json(last ? (result[0] || null) : result)
  }

  if (req.method === 'POST') {
    const { date, weight } = req.body
    if (!isValidDate(date)) return res.status(400).json({ error: 'date deve estar no formato YYYY-MM-DD' })
    const kg = parseNumberInRange(weight, 20, 400)
    if (kg === null) return res.status(400).json({ error: 'weight deve estar entre 20 e 400 kg' })

    const { data: existing } = await supabase
      .from('body_weight')
      .select('id')
      .eq('user_email', user.email)
      .eq('date', date)
      .maybeSingle()

    let result, error
    if (existing) {
      ;({ data: result, error } = await supabase
        .from('body_weight')
        .update({ weight: kg })
        .eq('id', existing.id)
        .eq('user_email', user.email)
        .select('id, date, weight')
        .single())
    } else {
      ;({ data: result, error } = await supabase
        .from('body_weight')
        .insert({ user_email: user.email, date, weight: kg })
        .select('id, date, weight')
        .single())
    }

    if (error) { console.error('body-weight POST:', error.message); return res.status(500).json({ error: error.message }) }
    return res.status(200).json({ id: result.id, date: result.date, weight: parseFloat(result.weight) })
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id obrigatório' })

    const { data, error } = await supabase
      .from('body_weight')
      .delete()
      .eq('id', id)
      .eq('user_email', user.email)
      .select('id')

    if (error) { console.error('body-weight DELETE:', error.message); return res.status(500).json({ error: error.message }) }
    if (!data?.length) return res.status(404).json({ error: 'Registro não encontrado' })
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
