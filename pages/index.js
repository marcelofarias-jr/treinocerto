import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatConfigs, muscleGroupLabels } from '../lib/workoutConfig'
import { todayFortaleza, humanSince } from '../lib/dates'
import { formatDuration } from '../lib/format'
import { apiFetch } from '../lib/api'
import { useToast } from '../components/ToastProvider'
import { calcStreak, recommendedDay, countSeries } from '../lib/workoutStats'

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function SessionModal({ session, onClose, onSaved, onDeleted }) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)      // cópia editável de exercisesData
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!session) return null

  const dateLabel = new Date(session.date + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  function startEditing() {
    // Só as séries concluídas entram na edição: as pendentes nunca foram
    // registradas, e mexer nelas mudaria o que o treino de fato foi.
    setDraft((session.exercisesData || []).map(ex => ({
      ...ex,
      sets: (ex.sets || []).map(set => ({ ...set })),
    })))
    setNotes(session.notes || '')
    setEditing(true)
  }

  function updateSet(ei, si, field, value) {
    setDraft(prev => prev.map((ex, i) => i !== ei ? ex : {
      ...ex,
      sets: ex.sets.map((set, j) => j !== si ? set : { ...set, [field]: value }),
    }))
  }

  async function save() {
    setSaving(true)
    try {
      const updated = await apiFetch('/api/sessions', {
        method: 'PUT',
        json: { id: session.id, exercisesData: draft, notes: notes.trim() || null },
      })
      onSaved(updated)
      setEditing(false)
      toast('Treino atualizado')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setSaving(true)
    try {
      await apiFetch('/api/sessions', { method: 'DELETE', json: { id: session.id } })
      onDeleted(session.id)
      toast('Treino removido do histórico')
      onClose()
    } catch (err) {
      toast(err.message, 'error')
      setSaving(false)
      setConfirmDelete(false)
    }
  }

  // Leitura: agrupa por músculo, só séries concluídas com carga.
  const byGroup = {}
  ;(session.exercisesData || []).forEach(ex => {
    const doneSets = (ex.sets || []).filter(s => s.done && s.carga)
    if (doneSets.length === 0) return
    const group = muscleGroupLabels[ex.muscleGroup] || ex.muscleGroup || 'Outros'
    if (!byGroup[group]) byGroup[group] = []
    byGroup[group].push({ name: ex.name, sets: doneSets })
  })
  const hasData = Object.keys(byGroup).length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div className="absolute inset-0 bg-black/75" onClick={editing ? undefined : onClose} />
      <div className="relative bg-[#1a1a1a] border border-zinc-700 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] text-zinc-400 tracking-widest mb-1 capitalize">{dateLabel}</p>
              <h3 className="font-heading font-black text-2xl uppercase text-white leading-tight">
                {session.dayLabel || 'Treino'}
              </h3>
              {session.duration > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs text-zinc-300">{formatDuration(session.duration, 'short')}</span>
                </div>
              )}
            </div>
            {!editing && (
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Corpo */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {editing ? (
            <>
              <p className="text-xs text-zinc-400">
                Corrija carga e repetições das séries registradas. Isso recalcula volume, PRs e o
                pré-preenchimento dos próximos treinos.
              </p>
              {draft.map((ex, ei) => {
                const doneIdx = ex.sets.map((set, si) => ({ set, si })).filter(x => x.set.done)
                if (doneIdx.length === 0) return null
                return (
                  <div key={ei}>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                      {muscleGroupLabels[ex.muscleGroup] || ex.muscleGroup}
                    </p>
                    <p className="text-sm font-semibold text-white mb-2">{ex.name}</p>
                    <div className="space-y-1.5">
                      {doneIdx.map(({ set, si }) => (
                        <div key={si} className="grid grid-cols-[28px_1fr_1fr] gap-2 items-center">
                          <span className="font-heading font-bold text-zinc-500 text-xs">{String(si + 1).padStart(2, '0')}</span>
                          <label className="flex items-center gap-1.5">
                            <input
                              type="number" inputMode="decimal" min="0" step="0.5"
                              value={set.carga ?? ''}
                              onChange={e => updateSet(ei, si, 'carga', e.target.value)}
                              className="w-full"
                            />
                            <span className="text-[10px] text-zinc-500 flex-shrink-0">kg</span>
                          </label>
                          <label className="flex items-center gap-1.5">
                            <input
                              type="number" inputMode="numeric" min="0"
                              value={set.repeticoes ?? ''}
                              onChange={e => updateSet(ei, si, 'repeticoes', e.target.value)}
                              className="w-full"
                            />
                            <span className="text-[10px] text-zinc-500 flex-shrink-0">reps</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Anotação</p>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Como você se sentiu, observações..."
                  className="w-full resize-none"
                />
              </div>
            </>
          ) : (
            <>
              {session.notes && (
                <div className="p-3 bg-zinc-800/50 rounded-xl border border-zinc-800">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Anotação</p>
                  <p className="text-sm text-zinc-200">{session.notes}</p>
                </div>
              )}
              {!hasData ? (
                <p className="text-zinc-300 text-sm text-center py-4">Nenhuma série registrada nesse treino.</p>
              ) : (
                Object.entries(byGroup).map(([group, exercises]) => (
                  <div key={group}>
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-3">{group}</p>
                    <div className="space-y-4">
                      {exercises.map((ex, ei) => (
                        <div key={ei}>
                          <p className="text-sm font-semibold text-white mb-2">{ex.name}</p>
                          <div className="space-y-1">
                            {ex.sets.map((set, si) => (
                              <div key={si} className="flex items-center gap-3 text-xs text-zinc-300">
                                <span className="w-6 font-heading font-bold text-zinc-500">{String(si + 1).padStart(2, '0')}</span>
                                <span className="flex-1">
                                  {set.carga && <span className="text-white font-semibold">{set.carga} kg</span>}
                                  {set.carga && set.repeticoes && <span className="text-zinc-500 mx-1">×</span>}
                                  {set.repeticoes && <span>{set.repeticoes} reps</span>}
                                </span>
                                <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        {/* Ações */}
        <div className="p-5 border-t border-zinc-800 flex-shrink-0">
          {editing ? (
            <div className="flex gap-3">
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                className="flex-1 py-3 border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-semibold uppercase tracking-wide text-xs rounded-xl transition-colors disabled:opacity-50"
              >
                Descartar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-3 bg-green-700 hover:bg-green-600 text-white font-heading font-bold uppercase tracking-widest text-sm rounded-xl transition-colors disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          ) : confirmDelete ? (
            <div>
              <p className="text-xs text-zinc-300 mb-3">
                Remover este treino do histórico? Ele sai do calendário, do total de treinos e das
                estatísticas.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={saving}
                  className="flex-1 py-2.5 border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-semibold uppercase tracking-wide text-xs rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={remove}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 text-white font-heading font-bold uppercase tracking-widest text-sm rounded-xl transition-colors disabled:opacity-50"
                >
                  {saving ? 'Removendo...' : 'Remover'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-4 py-2.5 border border-red-900 hover:border-red-600 text-red-500 hover:text-red-400 font-semibold uppercase tracking-wide text-xs rounded-xl transition-colors"
              >
                Excluir
              </button>
              <button
                onClick={startEditing}
                disabled={!(session.exercisesData || []).some(ex => (ex.sets || []).some(s => s.done))}
                className="flex-1 py-2.5 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-semibold uppercase tracking-wide text-xs rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Corrigir cargas
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Calendar({ sessions, onDayClick }) {
  // Mês inicial no fuso de Fortaleza, igual ao resto do app. Com o fuso do
  // aparelho, perto da virada do mês o calendário abria no mês errado.
  const [cursor, setCursor] = useState(() => {
    const [year, month] = todayFortaleza().split('-').map(Number)
    return { year, month: month - 1 }
  })

  const { year, month } = cursor
  const todayStr = todayFortaleza()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthLabel = new Date(year, month).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

  // Mapeia data → sessão mais recente
  const sessionsByDate = {}
  sessions.forEach(s => {
    if (!sessionsByDate[s.date] || s.id > sessionsByDate[s.date].id) {
      sessionsByDate[s.date] = s
    }
  })

  const cells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      return { d, dateStr, session: sessionsByDate[dateStr] || null, isToday: dateStr === todayStr }
    }),
  ]

  function prev() {
    setCursor(c => ({ year: c.month === 0 ? c.year - 1 : c.year, month: c.month === 0 ? 11 : c.month - 1 }))
  }
  function next() {
    setCursor(c => ({ year: c.month === 11 ? c.year + 1 : c.year, month: c.month === 11 ? 0 : c.month + 1 }))
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <button onClick={prev} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="font-heading font-bold uppercase tracking-widest text-white text-sm">{monthLabel}</p>
        <button onClick={next} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-widest text-zinc-300 mb-2">
        {WEEK_DAYS.map(d => <span key={d}>{d}</span>)}
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
        {cells.map((cell, i) => (
          <div key={i} className="flex items-center justify-center h-9">
            {cell && (
              <button
                onClick={() => cell.session && onDayClick(cell.session)}
                className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-all
                  ${cell.session ? 'bg-red-600 text-white font-bold hover:bg-red-500 cursor-pointer' : 'cursor-default'}
                  ${cell.isToday && !cell.session ? 'ring-2 ring-red-500 text-red-400' : ''}
                  ${!cell.session && !cell.isToday ? 'text-zinc-300' : ''}
                `}
              >
                {cell.d}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-5 mt-4 pt-4 border-t border-zinc-800">
        <span className="flex items-center gap-2 text-xs text-zinc-300">
          <span className="w-3 h-3 rounded-full bg-red-600 inline-block" /> Treino realizado
        </span>
        <span className="flex items-center gap-2 text-xs text-zinc-300">
          <span className="w-3 h-3 rounded-full ring-2 ring-red-500 inline-block" /> Hoje
        </span>
        <span className="text-xs text-zinc-400">Toque para ver detalhes</span>
      </div>
    </div>
  )
}

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const toast = useToast()
  const [workout, setWorkout] = useState(null)
  const [allSessions, setAllSessions] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [activeWorkout, setActiveWorkout] = useState(false)
  const [standaloneRunning, setStandaloneRunning] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [lastWeight, setLastWeight] = useState(undefined)
  const [weightInputHome, setWeightInputHome] = useState('')
  const [savingWeightHome, setSavingWeightHome] = useState(false)

  useEffect(() => {
    setActiveWorkout(!!localStorage.getItem('workoutStartTime'))
  }, [])

  useEffect(() => {
    if (!session) return
    Promise.all([
      fetch('/api/workouts').then(r => r.json()),
      fetch('/api/sessions').then(r => r.json()),
    ]).then(([workouts, sessions]) => {
      const ws = Array.isArray(workouts) ? workouts : []
      const ss = Array.isArray(sessions) ? sessions : []
      // Treino ativo marcado; senão, o mais recente (cobre "só há um treino").
      if (ws.length > 0) {
        const active = ws.find(w => w.isActive) || ws[ws.length - 1]
        // Sessão de outro plano em andamento: mostra o plano dela, não o ativo.
        const planId = localStorage.getItem('workoutStartTime') ? localStorage.getItem('workoutPlanId') : null
        const running = planId ? ws.find(w => String(w.id) === planId) : null
        setWorkout(running || active)
        setStandaloneRunning(!!running && running.id !== active.id)
      }
      setAllSessions(ss)
      setLoadingData(false)
    })
  }, [session])

  useEffect(() => {
    if (!session) return
    fetch('/api/body-weight?last=1')
      .then(r => (r.ok ? r.json() : null))
      .then(data => setLastWeight(data?.date ? data : null))
      .catch(() => setLastWeight(null))
  }, [session])

  if (status === 'loading') return null

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] px-4">
        <div className="max-w-sm w-full text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
              </svg>
            </div>
            <div className="text-left">
              <p className="font-heading font-black text-white text-xl uppercase tracking-wide leading-none">TreinoCerto</p>
              <p className="text-zinc-600 text-[10px] uppercase tracking-widest">Workout Tracker</p>
            </div>
          </div>
          <h1 className="font-heading font-black text-5xl uppercase leading-tight mb-2">MONTE O TREINO.</h1>
          <h1 className="font-heading font-black text-5xl uppercase leading-tight text-red-500 mb-4">LEVANTE PESADO.</h1>
          <p className="text-zinc-500 text-sm mb-8">Monte seu treino de hipertrofia e acompanhe sua evolução.</p>
          <button
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="w-full px-6 py-4 bg-red-600 hover:bg-red-700 text-white font-heading font-bold text-lg uppercase tracking-widest rounded-xl transition-colors"
          >
            Entrar com Google
          </button>
        </div>
      </div>
    )
  }

  const firstName = session.user.name?.split(' ')[0] || session.user.email.split('@')[0]
  const formatConfig = workout ? formatConfigs[workout.format] : null
  const streak = calcStreak(allSessions)
  const totalSessions = allSessions.length

function getRestAdvice(streak) {
    if (streak >= 6) return {
      level: 'critical',
      icon: '🛑',
      title: `${streak} dias seguidos — descanse hoje`,
      body: 'Treinar mais de 5 dias consecutivos aumenta o risco de overtraining, eleva o cortisol e prejudica a hipertrofia. O músculo cresce no descanso.',
      border: 'border-red-800',
      bg: 'bg-red-950/30',
      titleColor: 'text-red-400',
    }
    if (streak >= 4) return {
      level: 'warning',
      icon: '⚠️',
      title: `${streak} dias seguidos — planeje um descanso`,
      body: 'Especialistas recomendam 1–2 dias de descanso por semana. A recuperação muscular e do sistema nervoso central leva 48–72h.',
      border: 'border-amber-800',
      bg: 'bg-amber-950/20',
      titleColor: 'text-amber-400',
    }
    if (streak >= 3) return {
      level: 'tip',
      icon: '💡',
      title: 'Ótimo ritmo — inclua um dia de descanso em breve',
      body: 'Após 3–4 dias consecutivos o descanso potencializa os ganhos. O crescimento muscular acontece fora da academia.',
      border: 'border-zinc-700',
      bg: 'bg-zinc-800/30',
      titleColor: 'text-zinc-300',
    }
    return null
  }

  const restAdvice = getRestAdvice(streak)
  const nextDay = !loadingData && workout ? recommendedDay(workout, allSessions) : null

  // Há quanto tempo o plano exibido é o ativo (cai para a criação quando o
  // treino nunca foi marcado explicitamente) e quantas sessões desde então.
  const activeSinceIso = workout ? (workout.activatedAt || workout.createdAt) : null
  const activeSince = standaloneRunning ? null : humanSince(activeSinceIso)
  const activeSinceDate = activeSinceIso ? todayFortaleza(new Date(activeSinceIso)) : null
  const activeSessions = activeSinceDate
    ? allSessions.filter(s => s.date >= activeSinceDate).length
    : 0

  const today = todayFortaleza()
  const daysSinceLast = lastWeight
    ? Math.floor((new Date(today) - new Date(lastWeight.date)) / 86400000)
    : null
  const showWeightReminder = lastWeight !== undefined && (lastWeight === null || daysSinceLast > 7)

  async function saveWeightHome() {
    if (!weightInputHome) return
    setSavingWeightHome(true)
    try {
      const entry = await apiFetch('/api/body-weight', {
        json: { date: today, weight: parseFloat(weightInputHome) },
      })
      setLastWeight(entry)
      setWeightInputHome('')
      toast(`Peso de ${entry.weight}kg registrado`)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSavingWeightHome(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {selectedSession && (
        <SessionModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onSaved={updated => {
            setAllSessions(prev => prev.map(x => (x.id === updated.id ? updated : x)))
            setSelectedSession(updated)
          }}
          onDeleted={id => setAllSessions(prev => prev.filter(x => x.id !== id))}
        />
      )}


      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">

        {/* Hero */}
        <div className="relative bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-7 overflow-hidden">
          <div className="absolute top-0 right-0 w-56 h-56 bg-red-900/25 rounded-full blur-3xl pointer-events-none" />
          <p className="text-xs text-zinc-400 uppercase tracking-widest mb-3">Bem-vindo de volta</p>
          <h1 className="font-heading font-black text-4xl uppercase leading-tight text-white">
            OLÁ, {firstName.toUpperCase()}.
          </h1>
          <p className="font-heading font-black text-4xl uppercase leading-tight text-red-500">
            BORA TREINAR?
          </p>
        </div>

        {/* Streak + totais */}
        {!loadingData && allSessions.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
              <span className="text-3xl leading-none">🔥</span>
              <div>
                <p className="font-heading font-black text-2xl text-white leading-none">
                  {streak > 0 ? streak : '—'}
                </p>
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-0.5">
                  {streak > 1 ? 'dias seguidos' : streak === 1 ? 'dia seguido' : 'sem sequência'}
                </p>
              </div>
            </div>
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
              <span className="text-3xl leading-none">💪</span>
              <div>
                <p className="font-heading font-black text-2xl text-white leading-none">{totalSessions}</p>
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-0.5">treinos no total</p>
              </div>
            </div>
          </div>
        )}

        {/* Lembrete de peso */}
        {showWeightReminder && (
          <div className="border border-zinc-700 bg-[#1a1a1a] rounded-2xl p-4">
            <p className="text-sm font-bold text-zinc-200 mb-0.5">⚖️ Atualize seu peso</p>
            <p className="text-xs text-zinc-500 mb-3">
              {lastWeight
                ? `Último registro há ${daysSinceLast} dias`
                : 'Nenhum registro ainda'}
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="1"
                placeholder="kg"
                value={weightInputHome}
                onChange={e => setWeightInputHome(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveWeightHome()}
                className="flex-1 min-w-0"
              />
              <button
                onClick={saveWeightHome}
                disabled={!weightInputHome || savingWeightHome}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-heading font-bold text-xs uppercase tracking-widest rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                {savingWeightHome ? '...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}

        {/* Aviso de descanso */}
        {!loadingData && restAdvice && (
          <div className={`border ${restAdvice.border} ${restAdvice.bg} rounded-2xl p-4`}>
            <div className="flex items-start gap-3">
              <span className="text-xl leading-none flex-shrink-0 mt-0.5">{restAdvice.icon}</span>
              <div>
                <p className={`text-sm font-bold ${restAdvice.titleColor} mb-1`}>{restAdvice.title}</p>
                <p className="text-xs text-zinc-400 leading-relaxed">{restAdvice.body}</p>
              </div>
            </div>
          </div>
        )}

        {/* Treino atual */}
        {loadingData ? (
          <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-6 h-40 animate-pulse" />
        ) : workout ? (
          <div className={`border rounded-2xl p-6 transition-colors ${activeWorkout ? 'bg-amber-950/20 border-amber-700' : 'bg-[#1a1a1a] border-zinc-800'}`}>
            <div className="flex justify-between items-start mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs text-zinc-400 uppercase tracking-widest">
                    {standaloneRunning ? 'Treinando só hoje' : 'Treino atual'}
                  </p>
                  {activeWorkout && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/20 border border-amber-600 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-[10px] text-amber-400 uppercase tracking-widest font-bold">Em andamento</span>
                    </span>
                  )}
                </div>
                <h2 className="font-heading font-black text-2xl uppercase text-white">{formatConfig?.name}</h2>
                {!standaloneRunning && activeSince && (
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Ativo há <span className="text-zinc-200 font-semibold">{activeSince}</span>
                    {' · '}
                    {activeSessions} {activeSessions === 1 ? 'sessão' : 'sessões'} nesse período
                  </p>
                )}
                <p className="text-zinc-300 text-xs mt-1">
                  {workout.days?.length} {workout.days?.length === 1 ? 'dia' : 'dias'} de treino
                  {' · '}
                  {countSeries(workout.days)} séries
                </p>
              </div>
              <Link href="/my-workouts" className="text-xs text-zinc-400 hover:text-zinc-200 uppercase tracking-widest transition-colors">
                Ver todos →
              </Link>
            </div>

            {nextDay && !activeWorkout && (
              <div className="flex items-center gap-3 mb-4 p-3 bg-[#232323] border border-zinc-800 rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-0.5">Recomendado hoje</p>
                  <p className="font-heading font-bold text-white text-sm uppercase truncate">{nextDay.label}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 bg-red-600/20 border border-red-700/50 text-red-400 rounded-full uppercase tracking-widest flex-shrink-0">
                  Dia {nextDay.dayId}
                </span>
              </div>
            )}

            {activeWorkout && (
              <div className="flex items-start gap-3 p-3 bg-amber-900/20 border border-amber-800 rounded-xl mb-4">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-amber-300">Você tem um treino em andamento. Encerre-o antes de iniciar um novo.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => router.push('/treino')}
                className={`flex-1 py-3 font-heading font-bold uppercase tracking-widest rounded-xl transition-colors flex items-center justify-center gap-2 ${
                  activeWorkout ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {activeWorkout && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                {activeWorkout ? 'Continuar treino' : 'Iniciar treino'}
              </button>
              {!activeWorkout && (
                <Link
                  href={`/dashboard?edit=${workout.id}`}
                  className="px-4 py-3 border border-zinc-700 hover:border-zinc-500 rounded-xl text-zinc-400 hover:text-zinc-200 transition-colors text-xs font-semibold uppercase tracking-wide flex items-center"
                >
                  Editar
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-8 text-center">
            <p className="text-zinc-300 text-sm mb-5">Você ainda não tem um treino criado.</p>
            <Link href="/dashboard" className="inline-block px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-heading font-bold uppercase tracking-widest rounded-xl transition-colors">
              Criar meu treino
            </Link>
          </div>
        )}

        {/* Calendário */}
        <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-6">
          <p className="text-xs text-zinc-400 uppercase tracking-widest mb-5">Histórico de treinos</p>
          {loadingData ? (
            <div className="h-52 animate-pulse bg-zinc-800/50 rounded-xl" />
          ) : (
            <Calendar sessions={allSessions} onDayClick={setSelectedSession} />
          )}
        </div>

      </div>
    </div>
  )
}
