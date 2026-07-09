import supabase from '../../lib/supabase'

// Registro de suplementos por dia. A existência de uma linha (user, date, name)
// significa que o suplemento foi tomado naquele dia.
export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { email, from, to } = req.query
    if (!email) return res.status(400).json({ error: 'Email required' })

    let query = supabase
      .from('supplement_logs')
      .select('id, date, name')
      .eq('user_email', email)
      .order('date', { ascending: false })

    if (from) query = query.gte('date', from)
    if (to) query = query.lte('date', to)

    const { data, error } = await query
    if (error) { console.error('supplements GET:', error.message); return res.status(500).json({ error: error.message }) }
    return res.status(200).json(data || [])
  }

  if (req.method === 'POST') {
    const { userEmail, date, name } = req.body
    if (!userEmail || !date || !name) return res.status(400).json({ error: 'userEmail, date and name required' })

    // Idempotente: se já existir, apenas retorna o registro.
    const { data: existing } = await supabase
      .from('supplement_logs')
      .select('id, date, name')
      .eq('user_email', userEmail)
      .eq('date', date)
      .eq('name', name)
      .maybeSingle()

    if (existing) return res.status(200).json({ ...existing, taken: true })

    const { data, error } = await supabase
      .from('supplement_logs')
      .insert({ id: Date.now(), user_email: userEmail, date, name })
      .select('id, date, name')
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ...data, taken: true })
  }

  if (req.method === 'DELETE') {
    const { email, date, name } = req.query
    if (!email || !date || !name) return res.status(400).json({ error: 'email, date and name required' })

    const { error } = await supabase
      .from('supplement_logs')
      .delete()
      .eq('user_email', email)
      .eq('date', date)
      .eq('name', name)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true, taken: false })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
