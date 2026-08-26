import supabase from '../../lib/supabase'
import { requireUser } from '../../lib/apiAuth'

export default async function handler(req, res) {
  const user = await requireUser(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_email', user.email)
      .order('created_at', { ascending: true })

    if (error) { console.error('workouts GET:', error.message); return res.status(500).json({ error: error.message }) }

    return res.status(200).json(data.map(normalizeWorkout))
  }

  if (req.method === 'PUT') {
    const { id, format, days } = req.body
    if (!id) return res.status(400).json({ error: 'ID required' })
    if (!isValidDays(days)) return res.status(400).json({ error: 'days inválido' })

    // Escopo por dono: sem isso, qualquer id sobrescreveria o treino de outro.
    const { data, error } = await supabase
      .from('workouts')
      .update({ format, days, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_email', user.email)
      .select()

    if (error) { console.error('workouts PUT:', error.message); return res.status(500).json({ error: error.message }) }
    if (!data?.length) return res.status(404).json({ error: 'Treino não encontrado' })
    return res.status(200).json(normalizeWorkout(data[0]))
  }

  if (req.method === 'PATCH') {
    // Define o treino ativo do usuário (desmarca os demais) e registra desde
    // quando ele está ativo.
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id obrigatório' })

    // Confirma que o treino existe E é deste usuário ANTES de desmarcar os
    // outros. Sem essa ordem, um id inválido zera o ativo e não remarca nada,
    // deixando o usuário sem nenhum treino ativo.
    const { data: target, error: findError } = await supabase
      .from('workouts')
      .select('id')
      .eq('id', id)
      .eq('user_email', user.email)
      .maybeSingle()
    if (findError) { console.error('workouts PATCH find:', findError.message); return res.status(500).json({ error: findError.message }) }
    if (!target) return res.status(404).json({ error: 'Treino não encontrado' })

    const now = new Date().toISOString()

    // Se a migração de activated_at ainda não foi aplicada, faz o update sem a
    // coluna em vez de impedir a troca do treino ativo.
    let withTimestamp = true
    let { error: clearError } = await supabase
      .from('workouts')
      .update({ is_active: false, activated_at: null })
      .eq('user_email', user.email)

    if (clearError && isMissingActivatedAt(clearError)) {
      withTimestamp = false
      ;({ error: clearError } = await supabase
        .from('workouts')
        .update({ is_active: false })
        .eq('user_email', user.email))
    }
    if (clearError) { console.error('workouts PATCH clear:', clearError.message); return res.status(500).json({ error: clearError.message }) }

    const { data, error } = await supabase
      .from('workouts')
      .update(withTimestamp ? { is_active: true, activated_at: now } : { is_active: true })
      .eq('id', id)
      .eq('user_email', user.email)
      .select('id')
    if (error) { console.error('workouts PATCH set:', error.message); return res.status(500).json({ error: error.message }) }

    return res.status(200).json({ ok: true, activatedAt: withTimestamp ? now : null })
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'ID required' })

    const { data, error } = await supabase
      .from('workouts')
      .delete()
      .eq('id', id)
      .eq('user_email', user.email)
      .select('id')

    if (error) { console.error('workouts DELETE:', error.message); return res.status(500).json({ error: error.message }) }
    if (!data?.length) return res.status(404).json({ error: 'Treino não encontrado' })
    return res.status(200).json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}

// Valida a forma de days: lista de dias com blocos de exercícios por grupo.
function isValidDays(days) {
  if (!Array.isArray(days)) return false
  return days.every(d =>
    d && typeof d === 'object' &&
    Array.isArray(d.exercises) &&
    d.exercises.every(b => b && typeof b.muscleGroup === 'string' && Array.isArray(b.exercises))
  )
}

// Coluna activated_at ausente (migração pendente): PGRST204 no cache de schema
// do PostgREST, 42703 no Postgres.
function isMissingActivatedAt(error) {
  return error?.code === 'PGRST204' || error?.code === '42703' || /activated_at/.test(error?.message || '')
}

function normalizeWorkout(row) {
  return {
    id: row.id,
    format: row.format,
    days: row.days,
    isActive: !!row.is_active,
    activatedAt: row.activated_at || null,
    user: { email: row.user_email },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
