import supabase from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { format, days, user } = req.body

  const { data, error } = await supabase
    .from('workouts')
    .insert({
      id: Date.now(),
      user_email: user.email,
      format,
      days,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(200).json({ ok: true, id: data.id })
}
