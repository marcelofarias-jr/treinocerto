import supabase from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { email, last } = req.query
    if (!email) return res.status(400).json({ error: 'Email required' })

    let query = supabase
      .from('body_weight')
      .select('id, date, weight')
      .eq('user_email', email)
      .order('date', { ascending: last ? false : true })

    if (last) query = query.limit(1)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    const result = (data || []).map(r => ({ id: r.id, date: r.date, weight: parseFloat(r.weight) }))
    return res.status(200).json(last ? (result[0] || null) : result)
  }

  if (req.method === 'POST') {
    const { userEmail, date, weight } = req.body
    if (!userEmail || !date || !weight) return res.status(400).json({ error: 'userEmail, date and weight required' })

    const { data: existing } = await supabase
      .from('body_weight')
      .select('id')
      .eq('user_email', userEmail)
      .eq('date', date)
      .maybeSingle()

    let result, error
    if (existing) {
      ;({ data: result, error } = await supabase
        .from('body_weight')
        .update({ weight: parseFloat(weight) })
        .eq('id', existing.id)
        .select('id, date, weight')
        .single())
    } else {
      ;({ data: result, error } = await supabase
        .from('body_weight')
        .insert({ id: Date.now(), user_email: userEmail, date, weight: parseFloat(weight) })
        .select('id, date, weight')
        .single())
    }

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ id: result.id, date: result.date, weight: parseFloat(result.weight) })
  }

  if (req.method === 'DELETE') {
    const { id, email } = req.query
    if (!id || !email) return res.status(400).json({ error: 'id and email required' })

    const { error } = await supabase
      .from('body_weight')
      .delete()
      .eq('id', id)
      .eq('user_email', email)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
