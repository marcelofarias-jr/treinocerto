import supabase from '../../lib/supabase'

export default async function handler(req, res) {
  const vars = {
    SUPABASE_URL: process.env.SUPABASE_URL ?? 'NOT SET',
    SUPABASE_KEY_PREFIX: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) ?? 'NOT SET',
  }

  try {
    const { data, error } = await supabase.from('workouts').select('id').limit(1)
    res.status(200).json({ ...vars, db: error ? `ERROR: ${error.message}` : 'OK', data })
  } catch (e) {
    res.status(200).json({ ...vars, db: `EXCEPTION: ${e.message}` })
  }
}
