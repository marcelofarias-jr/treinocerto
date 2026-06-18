import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { muscleGroupLabels } from '../lib/workoutConfig'

function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.6)
  } catch (_) {}
}

function buildHistory(sessions) {
  const sorted = [...sessions]
    .filter(s => s.exercisesData?.length > 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const lastSetsMap = {}
  const prMap = {}

  sorted.forEach(sess => {
    sess.exercisesData.forEach(exData => {
      if (!lastSetsMap[exData.name]) {
        lastSetsMap[exData.name] = { sets: exData.sets, date: sess.date }
      }
      exData.sets?.forEach(set => {
        if (set.done && set.carga) {
          const w = parseFloat(set.carga) || 0
          if (w > (prMap[exData.name] || 0)) prMap[exData.name] = w
        }
      })
    })
  })

  const all = new Set([...Object.keys(lastSetsMap), ...Object.keys(prMap)])
  const history = {}
  all.forEach(name => {
    history[name] = {
      lastSets: lastSetsMap[name]?.sets || [],
      lastDate: lastSetsMap[name]?.date || null,
      pr: prMap[name] || null,
    }
  })
  return history
}

function WorkoutTimer({ seconds }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] border border-zinc-800 rounded-lg">
      <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="font-heading font-bold text-white text-sm tracking-widest">{fmt(seconds)}</span>
    </div>
  )
}

function RestTimerOverlay({ endTime, totalSeconds, onDone }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
  )
  const alerted = useRef(false)
  const doneFired = useRef(false)

  function triggerAlert() {
    if (alerted.current) return
    alerted.current = true
    playBeep()
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 500])
  }

  useEffect(() => {
    function update() {
      const rem = Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
      setRemaining(rem)
      if (rem <= 0) triggerAlert()
    }

    function onVisible() {
      if (!document.hidden) update()
    }

    update()
    const t = setInterval(update, 500)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [endTime])

  useEffect(() => {
    if (remaining <= 0 && !doneFired.current) {
      doneFired.current = true
      const t = setTimeout(onDone, 1200)
      return () => clearTimeout(t)
    }
  }, [remaining])

  const pct = Math.min(100, Math.round(((totalSeconds - remaining) / totalSeconds) * 100))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
      <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-10 text-center max-w-sm w-full">
        <p className="text-xs text-zinc-400 uppercase tracking-widest mb-6">Descanso</p>
        <p className={`font-heading font-black text-8xl leading-none mb-6 transition-colors ${remaining <= 5 ? 'text-red-500' : 'text-white'}`}>
          {fmt(remaining)}
        </p>
        <div className="h-1.5 bg-zinc-800 rounded-full mb-8 overflow-hidden">
          <div className="h-1.5 bg-red-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <button onClick={onDone} className="text-zinc-400 hover:text-zinc-300 text-xs uppercase tracking-widest transition-colors">
          Pular descanso
        </button>
      </div>
    </div>
  )
}

function clearWorkoutStorage() {
  localStorage.removeItem('workoutStartTime')
  localStorage.removeItem('workoutDayId')
  localStorage.removeItem('workoutCurrentIdx')
  localStorage.removeItem('workoutSetsData')
}

export default function Treino() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [workout, setWorkout] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedDayId, setSelectedDayId] = useState(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [setsData, setSetsData] = useState({})
  const [elapsed, setElapsed] = useState(0)
  const [restEndTime, setRestEndTime] = useState(null)
  const [restTotal, setRestTotal] = useState(60)
  const [finishing, setFinishing] = useState(false)
  const [summary, setSummary] = useState(null)
  const [exerciseHistory, setExerciseHistory] = useState({})
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [previewDay, setPreviewDay] = useState(null)
  const [viewOnly, setViewOnly] = useState(false)
  const [sessionNotes, setSessionNotes] = useState('')
  const listRef = useRef(null)

  // Carrega o treino do usuário e restaura sessão ativa se houver
  useEffect(() => {
    if (!session) return
    fetch(`/api/workouts?email=${session.user.email}`)
      .then(r => r.json())
      .then(ws => {
        const w = ws.length > 0 ? ws[ws.length - 1] : null
        setWorkout(w)
        setLoading(false)

        if (!w) return
        const startTime = localStorage.getItem('workoutStartTime')
        const savedDayId = localStorage.getItem('workoutDayId')
        if (!startTime || !savedDayId) return

        // Verifica se o dayId ainda existe no treino atual
        if (!w.days.some(d => d.dayId === savedDayId)) { clearWorkoutStorage(); return }

        setSelectedDayId(savedDayId)
        setCurrentIdx(parseInt(localStorage.getItem('workoutCurrentIdx') || '0'))

        // Tenta restaurar setsData do localStorage
        let restoredSets = null
        try {
          const saved = localStorage.getItem('workoutSetsData')
          if (saved) restoredSets = JSON.parse(saved)
        } catch (_) {}

        const hasRestoredSets = restoredSets && Object.keys(restoredSets).length > 0

        // Busca histórico e, se necessário, reinicializa os sets a partir da configuração do treino
        fetch(`/api/sessions?email=${session.user.email}`)
          .then(r => r.json())
          .then(sessions => {
            const history = buildHistory(sessions)
            setExerciseHistory(history)

            if (hasRestoredSets) {
              setSetsData(restoredSets)
            } else {
              // setsData não estava salvo — inicializa a partir do treino + histórico
              const d = w.days.find(d => d.dayId === savedDayId)
              const exs = d.exercises.flatMap(mg =>
                mg.exercises.map(ex => typeof ex === 'string' ? { name: ex } : ex)
              )
              const init = {}
              exs.forEach((ex, i) => {
                const n = Math.max(1, parseInt(ex.series) || 3)
                const prev = history[ex.name]?.lastSets || []
                init[i] = Array.from({ length: n }, (_, si) => ({
                  carga: prev[si]?.carga || ex.carga || '',
                  repeticoes: prev[si]?.repeticoes || ex.repeticoes || '',
                  done: false,
                }))
              })
              setSetsData(init)
              localStorage.setItem('workoutSetsData', JSON.stringify(init))
            }
          })
      })
  }, [session])

  // Timer baseado no timestamp real — não para ao sair da aba ou bloquear o celular
  useEffect(() => {
    const saved = localStorage.getItem('workoutStartTime')
    if (saved) setElapsed(Math.floor((Date.now() - parseInt(saved)) / 1000))
    const t = setInterval(() => {
      const start = localStorage.getItem('workoutStartTime')
      if (start) setElapsed(Math.floor((Date.now() - parseInt(start)) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [])

  // Persiste setsData e currentIdx em tempo real
  useEffect(() => {
    if (!localStorage.getItem('workoutStartTime')) return
    localStorage.setItem('workoutSetsData', JSON.stringify(setsData))
  }, [setsData])

  useEffect(() => {
    if (!localStorage.getItem('workoutStartTime')) return
    localStorage.setItem('workoutCurrentIdx', String(currentIdx))
  }, [currentIdx])

  if (status === 'loading' || loading) {
    return <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center text-zinc-500">Carregando...</div>
  }
  if (!session) { router.push('/'); return null }
  if (!workout) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center px-4">
        <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-8 text-center max-w-sm">
          <p className="text-zinc-300 mb-5">Nenhum treino encontrado.</p>
          <button onClick={() => router.push('/dashboard')} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-heading font-bold uppercase tracking-widest rounded-xl transition-colors">
            Criar treino
          </button>
        </div>
      </div>
    )
  }

  const day = selectedDayId != null ? workout.days.find(d => d.dayId === selectedDayId) : null
  const flatEx = day
    ? day.exercises.flatMap(mg =>
        mg.exercises.map(ex => ({ ...(typeof ex === 'string' ? { name: ex } : ex), muscleGroup: mg.muscleGroup }))
      )
    : []

  async function startDay(dayId) {
    const d = workout.days.find(d => d.dayId === dayId)
    const exs = d.exercises.flatMap(mg =>
      mg.exercises.map(ex => typeof ex === 'string' ? { name: ex } : ex)
    )

    // Carrega histórico de sessões
    const allSessions = await fetch(`/api/sessions?email=${session.user.email}`).then(r => r.json())
    const history = buildHistory(allSessions)
    setExerciseHistory(history)

    // Inicializa sets pré-preenchidos com dados do último treino
    const init = {}
    exs.forEach((ex, i) => {
      const n = Math.max(1, parseInt(ex.series) || 3)
      const prev = history[ex.name]?.lastSets || []
      init[i] = Array.from({ length: n }, (_, si) => ({
        carga: prev[si]?.carga || ex.carga || '',
        repeticoes: prev[si]?.repeticoes || ex.repeticoes || '',
        done: false,
      }))
    })

    setSetsData(init)
    setSelectedDayId(dayId)
    setCurrentIdx(0)
    localStorage.setItem('workoutStartTime', String(Date.now()))
    localStorage.setItem('workoutDayId', dayId)
    localStorage.setItem('workoutCurrentIdx', '0')
    localStorage.setItem('workoutSetsData', JSON.stringify(init))
  }

  async function viewDay(dayId) {
    const d = workout.days.find(d => d.dayId === dayId)
    const exs = d.exercises.flatMap(mg =>
      mg.exercises.map(ex => typeof ex === 'string' ? { name: ex } : ex)
    )
    const allSessions = await fetch(`/api/sessions?email=${session.user.email}`).then(r => r.json())
    const history = buildHistory(allSessions)
    setExerciseHistory(history)

    const init = {}
    exs.forEach((ex, i) => {
      const n = Math.max(1, parseInt(ex.series) || 3)
      const prev = history[ex.name]?.lastSets || []
      init[i] = Array.from({ length: n }, (_, si) => ({
        carga: prev[si]?.carga || ex.carga || '',
        repeticoes: prev[si]?.repeticoes || ex.repeticoes || '',
        done: prev[si]?.done || false,
      }))
    })

    setSetsData(init)
    setSelectedDayId(dayId)
    setCurrentIdx(0)
    setViewOnly(true)
  }

  function updateSet(ei, si, field, value) {
    setSetsData(prev => {
      const sets = [...(prev[ei] || [])]
      sets[si] = { ...sets[si], [field]: value }
      return { ...prev, [ei]: sets }
    })
  }

  function markDone(ei, si) {
    setSetsData(prev => {
      const sets = [...(prev[ei] || [])]
      if (sets[si].done) return prev
      sets[si] = { ...sets[si], done: true }
      return { ...prev, [ei]: sets }
    })
    const ds = parseInt(flatEx[ei]?.descanso) || 60
    if (ds > 0) {
      const end = Date.now() + ds * 1000
      setRestEndTime(end)
      setRestTotal(ds)
      localStorage.setItem('restTimerEnd', String(end))
    }
  }

  function getExProg(ei) {
    const sets = setsData[ei] || []
    return { done: sets.filter(s => s.done).length, total: sets.length }
  }

  function getStats() {
    const total = flatEx.length
    const totalSets = Object.values(setsData).reduce((a, s) => a + s.length, 0)
    const doneSets = Object.values(setsData).reduce((a, s) => a + s.filter(s => s.done).length, 0)
    const pct = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0
    return { total, totalSets, doneSets, pct }
  }

  function cancelWorkout() {
    clearWorkoutStorage()
    setSelectedDayId(null)
    setSetsData({})
    setCurrentIdx(0)
    setElapsed(0)
    router.push('/')
  }

  async function finish() {
    setFinishing(true)
    const start = localStorage.getItem('workoutStartTime')
    const finalElapsed = start ? Math.floor((Date.now() - parseInt(start)) / 1000) : elapsed

    const exercisesData = flatEx.map((ex, i) => ({
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      sets: setsData[i] || [],
    }))

    // Computa resumo antes de limpar o storage
    let totalVolume = 0
    let totalSetsCompleted = 0
    let totalReps = 0
    const exSummaries = flatEx.map((ex, i) => {
      const hist = exerciseHistory[ex.name] || {}
      const curSets  = (setsData[i] || []).filter(s => s.done)
      const prevSets = (hist.lastSets || []).filter(s => s.done && s.carga)

      const curMaxW  = curSets.length  ? Math.max(...curSets.map(s => parseFloat(s.carga) || 0))  : 0
      const prevMaxW = prevSets.length ? Math.max(...prevSets.map(s => parseFloat(s.carga) || 0)) : 0
      const curReps  = curSets.reduce((a, s)  => a + (parseInt(s.repeticoes) || 0), 0)
      const prevReps = prevSets.reduce((a, s) => a + (parseInt(s.repeticoes) || 0), 0)
      const volume   = curSets.reduce((a, s)  => a + (parseFloat(s.carga) || 0) * (parseInt(s.repeticoes) || 0), 0)

      totalVolume       += volume
      totalSetsCompleted += curSets.length
      totalReps         += curReps

      const isNewPR    = curMaxW > 0 && curMaxW > (hist.pr || 0)
      const weightDiff = prevMaxW > 0 && curMaxW > 0 ? curMaxW - prevMaxW : null
      const repsDiff   = prevReps > 0 && curReps  > 0 ? curReps  - prevReps  : null
      const hasPrev    = prevSets.length > 0

      return { name: ex.name, muscleGroup: ex.muscleGroup, curMaxW, prevMaxW, curReps, prevReps, isNewPR, weightDiff, repsDiff, hasPrev, setsCompleted: curSets.length }
    }).filter(e => e.setsCompleted > 0)

    clearWorkoutStorage()

    const today = new Date().toISOString().split('T')[0]
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: session.user.email,
        date: today,
        workoutId: workout.id,
        dayId: day.dayId,
        dayLabel: day.label,
        duration: finalElapsed,
        exercisesData,
        notes: sessionNotes.trim() || null,
      }),
    })

    setSummary({ duration: finalElapsed, totalVolume, totalSetsCompleted, totalReps, exSummaries })
    setFinishing(false)
  }

  /* ── Resumo pós-treino ── */
  if (summary) {
    const prs       = summary.exSummaries.filter(e => e.isNewPR)
    const weightUp  = summary.exSummaries.filter(e => !e.isNewPR && e.weightDiff > 0)
    const repsUp    = summary.exSummaries.filter(e => !e.isNewPR && e.weightDiff <= 0 && e.repsDiff > 0)
    const unchanged = summary.exSummaries.filter(e => !e.isNewPR && !(e.weightDiff > 0) && !(e.repsDiff > 0) && e.hasPrev)
    const noHistory = summary.exSummaries.filter(e => !e.hasPrev)

    function fmtVol(kg) {
      if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`
      return `${Math.round(kg)}kg`
    }

    return (
      <div className="min-h-screen bg-[#0f0f0f]">
        <div className="max-w-lg mx-auto px-4 py-8 pb-28 space-y-4">

          {/* Hero */}
          <div className="relative bg-[#1a1a1a] border border-green-900/50 rounded-2xl p-6 overflow-hidden text-center">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-700 via-green-500 to-green-700" />
            <div className="w-14 h-14 bg-green-900/40 border border-green-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="font-heading font-black text-3xl uppercase text-white mb-1">Treino concluído!</h1>
            <p className="text-zinc-400 text-sm">{day?.label} · {fmt(summary.duration)}</p>
          </div>

          {/* KPIs rápidos */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-xl p-3 text-center">
              <p className="font-heading font-black text-2xl text-white">{summary.totalSetsCompleted}</p>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-0.5">Séries</p>
            </div>
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-xl p-3 text-center">
              <p className="font-heading font-black text-2xl text-white">{summary.totalReps}</p>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-0.5">Reps</p>
            </div>
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-xl p-3 text-center">
              <p className="font-heading font-black text-2xl text-white">{fmtVol(summary.totalVolume)}</p>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-0.5">Volume</p>
            </div>
          </div>

          {/* Novos PRs */}
          {prs.length > 0 && (
            <div className="bg-yellow-950/30 border border-yellow-700/50 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest mb-3">🏆 Novos recordes pessoais</p>
              <div className="space-y-2">
                {prs.map(e => (
                  <div key={e.name} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-200">{e.name}</span>
                    <span className="font-heading font-black text-yellow-400 text-base">{e.curMaxW}kg</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progressos */}
          {(weightUp.length > 0 || repsUp.length > 0) && (
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-3">↑ Evolução</p>
              <div className="space-y-2.5">
                {weightUp.map(e => (
                  <div key={e.name} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-200 flex-1 truncate mr-3">{e.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-zinc-500">{e.prevMaxW}kg</span>
                      <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                      <span className="text-sm font-semibold text-green-400">{e.curMaxW}kg</span>
                      <span className="text-[10px] text-green-600 font-bold">+{e.weightDiff}kg</span>
                    </div>
                  </div>
                ))}
                {repsUp.map(e => (
                  <div key={e.name} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-200 flex-1 truncate mr-3">{e.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-zinc-500">{e.prevReps} reps</span>
                      <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                      <span className="text-sm font-semibold text-green-400">{e.curReps} reps</span>
                      <span className="text-[10px] text-green-600 font-bold">+{e.repsDiff}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mantidos / sem alteração */}
          {unchanged.length > 0 && (
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">= Mantidos</p>
              <div className="space-y-2">
                {unchanged.map(e => (
                  <div key={e.name} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">{e.name}</span>
                    <span className="text-xs text-zinc-500">{e.curMaxW > 0 ? `${e.curMaxW}kg` : `${e.curReps} reps`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sem histórico para comparar */}
          {noHistory.length > 0 && (
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Primeiro registro</p>
              <div className="space-y-2">
                {noHistory.map(e => (
                  <div key={e.name} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">{e.name}</span>
                    <span className="text-xs text-zinc-400">{e.curMaxW > 0 ? `${e.curMaxW}kg` : `${e.curReps} reps`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => router.push('/')} className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-heading font-bold uppercase tracking-widest rounded-xl transition-colors">
            Voltar ao início
          </button>

        </div>
      </div>
    )
  }

  /* ── Seleção de dia ── */
  if (!day) {
    return (
      <div className="min-h-screen bg-[#0f0f0f]">
        <div className="max-w-lg mx-auto px-4 py-8">
          <p className="text-xs text-zinc-400 uppercase tracking-widest mb-2">Treinar</p>
          <h1 className="font-heading font-black text-4xl uppercase text-white mb-1">Qual dia é hoje?</h1>
          <p className="text-zinc-300 text-sm mb-6">Escolha o dia do treino que você vai realizar.</p>
          <div className="space-y-3">
            {workout.days.map(d => {
              const total = d.exercises.reduce((a, mg) => a + mg.exercises.length, 0)
              return (
                <button key={d.dayId} onClick={() => setPreviewDay(d)}
                  className="w-full bg-[#1a1a1a] border border-zinc-800 hover:border-zinc-600 rounded-2xl p-5 text-left transition-all group">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Dia {d.dayId}</p>
                      <p className="font-heading font-black text-xl uppercase text-white">{d.label}</p>
                      <p className="text-zinc-300 text-xs mt-1">{total} exercícios</p>
                    </div>
                    <svg className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Modal de prévia do dia */}
        {previewDay && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
            <div className="absolute inset-0 bg-black/75" onClick={() => setPreviewDay(null)} />
            <div className="relative bg-[#1a1a1a] border border-zinc-700 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] flex flex-col">

              {/* Header */}
              <div className="p-5 border-b border-zinc-800 flex-shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest mb-1">Dia {previewDay.dayId}</p>
                    <h3 className="font-heading font-black text-2xl uppercase text-white leading-tight">{previewDay.label}</h3>
                    <p className="text-zinc-400 text-xs mt-1">
                      {previewDay.exercises.reduce((a, mg) => a + mg.exercises.length, 0)} exercícios
                    </p>
                  </div>
                  <button onClick={() => setPreviewDay(null)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Lista de exercícios */}
              <div className="overflow-y-auto flex-1 p-5 space-y-4">
                {previewDay.exercises.map(mg => {
                  const exList = mg.exercises.map(ex => typeof ex === 'string' ? { name: ex } : ex)
                  return (
                    <div key={mg.muscleGroup}>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                        {muscleGroupLabels[mg.muscleGroup] || mg.muscleGroup}
                      </p>
                      <div className="space-y-1.5">
                        {exList.map((ex, i) => (
                          <div key={i} className="flex items-center gap-3 py-1.5 border-b border-zinc-800/50 last:border-0">
                            <span className="text-xs font-mono text-zinc-600 w-4 text-right flex-shrink-0">{i + 1}</span>
                            <span className="text-sm text-zinc-200 flex-1">{ex.name}</span>
                            {(ex.series || ex.repeticoes) && (
                              <span className="text-xs text-zinc-500 flex-shrink-0">
                                {ex.series && `${ex.series}×`}{ex.repeticoes && `${ex.repeticoes}`}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Ações */}
              <div className="p-5 border-t border-zinc-800 flex-shrink-0 flex gap-3">
                <button
                  onClick={() => { const id = previewDay.dayId; setPreviewDay(null); viewDay(id) }}
                  className="flex-1 py-3 border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-semibold uppercase tracking-wide text-xs rounded-xl transition-colors"
                >
                  Só visualizar
                </button>
                <button
                  onClick={() => { setPreviewDay(null); startDay(previewDay.dayId) }}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-heading font-bold uppercase tracking-widest text-sm rounded-xl transition-colors"
                >
                  Iniciar treino
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ── Treino ativo ── */
  const { total, totalSets, doneSets, pct } = getStats()
  const ex = flatEx[currentIdx]
  const sets = setsData[currentIdx] || []
  const isLast = currentIdx === flatEx.length - 1
  const hist = exerciseHistory[ex?.name] || {}

  // Formata os sets do último treino para exibição
  const lastSetsLabel = hist.lastSets?.length
    ? hist.lastSets
        .filter(s => s.done && s.carga)
        .map(s => `${s.carga}kg × ${s.repeticoes}`)
        .join('  ·  ')
    : null

  return (
    <div className="min-h-screen bg-[#0f0f0f]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {restEndTime && (
        <RestTimerOverlay endTime={restEndTime} totalSeconds={restTotal} onDone={() => { setRestEndTime(null); localStorage.removeItem('restTimerEnd') }} />
      )}

      {showFinishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/75" onClick={() => setShowFinishModal(false)} />
          <div className="relative bg-[#1a1a1a] border border-zinc-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-900/40 border border-green-700 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-heading font-black text-xl uppercase text-white leading-none">Encerrar treino</h3>
                <p className="text-zinc-400 text-xs mt-0.5">Tempo: {fmt(elapsed)}</p>
              </div>
            </div>
            <p className="text-zinc-300 text-sm mb-4">
              Os dados das séries completadas serão salvos. Séries não marcadas como feitas serão ignoradas.
            </p>
            <textarea
              value={sessionNotes}
              onChange={e => setSessionNotes(e.target.value)}
              placeholder="Anotação da sessão (opcional) — como você se sentiu, observações..."
              rows={3}
              className="w-full mb-5 resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowFinishModal(false)}
                className="flex-1 py-2.5 border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-semibold uppercase tracking-wide text-xs rounded-xl transition-colors"
              >
                Continuar
              </button>
              <button
                onClick={() => { setShowFinishModal(false); finish() }}
                disabled={finishing}
                className="flex-1 py-2.5 bg-green-700 hover:bg-green-600 text-white font-heading font-bold uppercase tracking-widest text-sm rounded-xl transition-colors disabled:opacity-50"
              >
                {finishing ? 'Salvando...' : 'Salvar treino'}
              </button>
            </div>

            {/* Opção destrutiva: cancelar sem salvar */}
            <div className="mt-5 pt-4 border-t border-zinc-800">
              <button
                onClick={() => { setShowFinishModal(false); setShowCancelConfirm(true) }}
                className="w-full py-2.5 text-red-500 hover:text-red-400 font-semibold uppercase tracking-wide text-xs transition-colors"
              >
                Cancelar treino sem salvar
              </button>
              <p className="text-zinc-400 text-[11px] text-center mt-1">
                O treino não ficará no histórico
              </p>
            </div>
          </div>
        </div>
      )}

      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/75" onClick={() => setShowCancelConfirm(false)} />
          <div className="relative bg-[#1a1a1a] border border-red-900 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-900/40 border border-red-700 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h3 className="font-heading font-black text-xl uppercase text-white leading-none">Cancelar treino</h3>
                <p className="text-zinc-400 text-xs mt-0.5">Tempo: {fmt(elapsed)}</p>
              </div>
            </div>
            <p className="text-zinc-300 text-sm mb-6">
              Todo o progresso será perdido. O treino não será salvo no histórico.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 py-3 border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-semibold uppercase tracking-wide text-xs rounded-xl transition-colors"
              >
                Manter treino
              </button>
              <button
                onClick={cancelWorkout}
                className="flex-1 py-3 bg-red-700 hover:bg-red-600 text-white font-heading font-bold uppercase tracking-widest text-sm rounded-xl transition-colors"
              >
                Sim, cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 pt-0 pb-6">
        {/* Top bar — fixo no topo durante o scroll */}
        <div className="sticky top-0 z-30 bg-[#0f0f0f] py-4 -mx-4 px-4 mb-5 flex items-center justify-between">
          <button
            onClick={() => { setSelectedDayId(null); setViewOnly(false); setSetsData({}) }}
            className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 uppercase tracking-widest transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar
          </button>
          <div className="flex items-center gap-3">
            {viewOnly ? (
              <>
                <span className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-400 font-semibold uppercase tracking-widest">
                  Visualizando
                </span>
                <button
                  onClick={() => { setViewOnly(false); startDay(day.dayId) }}
                  className="flex items-center gap-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-heading font-bold uppercase tracking-widest text-xs rounded-lg transition-colors"
                >
                  Iniciar treino
                </button>
              </>
            ) : (
              <>
                <WorkoutTimer seconds={elapsed} />
                <button
                  onClick={() => setShowFinishModal(true)}
                  className="flex items-center gap-2 px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white font-heading font-bold uppercase tracking-widest text-xs rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Encerrar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Hero */}
        <div className="relative bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-4 md:p-6 mb-4 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-900/20 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 mr-6">
              <p className="text-xs text-zinc-400 uppercase tracking-widest mb-2">Treino de hoje · {day.dayId}</p>
              <h1 className="font-heading font-black text-3xl md:text-4xl uppercase text-white leading-tight">
                {day.exercises.map(mg => (muscleGroupLabels[mg.muscleGroup] || mg.muscleGroup).toUpperCase()).join(' · ')}
              </h1>
              <div className="flex items-center gap-5 mt-3">
                <span className="flex items-center gap-1.5 text-xs text-zinc-300">
                  <svg className="w-3.5 h-3.5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
                  </svg>
                  {total} exercícios
                </span>
                <span className="flex items-center gap-1.5 text-xs text-zinc-300">
                  <svg className="w-3.5 h-3.5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {totalSets} séries
                </span>
                <span className="flex items-center gap-1.5 text-xs text-zinc-300">
                  <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {doneSets} completas
                </span>
              </div>
            </div>
            <p className="font-heading font-black text-4xl text-red-500 flex-shrink-0">{pct}%</p>
          </div>
          <div className="mt-4 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-1 bg-red-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Mobile: exercise pills (horizontal scroll) */}
        <div className="md:hidden flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-4">
          {flatEx.map((e, i) => {
            const { done: d, total: t } = getExProg(i)
            const active = i === currentIdx
            const complete = d === t && t > 0
            return (
              <button key={i} onClick={() => setCurrentIdx(i)}
                className={`flex-shrink-0 flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all min-w-[72px] ${
                  active ? 'bg-red-900/40 border-red-600'
                  : complete ? 'bg-green-950/30 border-green-900'
                  : 'bg-[#1a1a1a] border-zinc-800'
                }`}
              >
                <span className={`w-7 h-7 rounded flex items-center justify-center text-xs font-black ${
                  active ? 'bg-red-600 text-white'
                  : complete ? 'bg-green-700 text-white'
                  : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {complete
                    ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    : i + 1
                  }
                </span>
                <span className={`text-[10px] text-center leading-tight w-full line-clamp-2 ${
                  active ? 'text-white' : complete ? 'text-green-400' : 'text-zinc-300'
                }`}>{e.name}</span>
              </button>
            )
          })}
        </div>

        {/* Split layout */}
        <div className="flex flex-col md:flex-row gap-4 md:min-h-[420px]">
          {/* Esquerda: lista de exercícios (desktop only) */}
          <div ref={listRef} className="hidden md:block w-64 flex-shrink-0 space-y-2 overflow-y-auto max-h-[520px]">
            {flatEx.map((e, i) => {
              const { done: d, total: t } = getExProg(i)
              const active = i === currentIdx
              const complete = d === t && t > 0
              const h = exerciseHistory[e.name]
              const lastWeights = h?.lastSets?.filter(s => s.carga).map(s => s.carga) || []
              const lastWeightLabel = lastWeights.length ? lastWeights.join(' · ') + ' kg' : null
              return (
                <button key={i} onClick={() => setCurrentIdx(i)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    active ? 'bg-red-900/40 border-red-600'
                    : complete ? 'bg-green-950/30 border-green-900 hover:border-green-700'
                    : 'bg-[#1a1a1a] border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded flex-shrink-0 flex items-center justify-center text-xs font-black ${
                      active ? 'bg-red-600 text-white'
                      : complete ? 'bg-green-700 text-white'
                      : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {complete
                        ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        : i + 1
                      }
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-sm font-medium truncate leading-snug ${
                          active ? 'text-white'
                          : complete ? 'text-green-400'
                          : 'text-zinc-300'
                        }`}>
                          {e.name}
                        </p>
                        {complete && !active && (
                          <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <p className={`text-[10px] uppercase tracking-wide mt-0.5 ${complete ? 'text-green-700' : 'text-zinc-400'}`}>
                        {(muscleGroupLabels[e.muscleGroup] || e.muscleGroup).toUpperCase()} · {d}/{t} séries
                      </p>
                      {lastWeightLabel && (
                        <p className="text-[10px] text-zinc-400 mt-0.5 truncate">{lastWeightLabel}</p>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Direita: detalhe do exercício */}
          <div className="flex-1 bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-6 flex flex-col">
            {/* Header do exercício */}
            <div className="mb-5">
              <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">
                {(muscleGroupLabels[ex.muscleGroup] || ex.muscleGroup).toUpperCase()}
                {ex.repeticoes ? ` · Alvo ${ex.repeticoes} reps` : ''}
              </p>
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-heading font-black text-3xl uppercase text-white">{ex.name}</h2>
                {hist.pr && (
                  <div className="flex-shrink-0 px-3 py-1.5 bg-red-900/30 border border-red-800 rounded-lg text-center">
                    <p className="text-[9px] text-red-400 uppercase tracking-widest leading-none mb-0.5">Recorde</p>
                    <p className="font-heading font-black text-red-400 text-lg leading-none">{hist.pr}kg</p>
                  </div>
                )}
              </div>
              {ex.observacoes && (
                <div className="mt-3 border-l-2 border-red-600 pl-3">
                  <p className="text-sm text-zinc-400">
                    <span className="text-zinc-300 font-semibold">Obs.</span> {ex.observacoes}
                  </p>
                </div>
              )}
            </div>

            {/* Referência do último treino */}
            {lastSetsLabel && (
              <div className="flex items-start gap-3 p-3 bg-[#232323] border border-zinc-800 rounded-xl mb-5">
                <svg className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">
                    Último treino · {hist.lastDate ? new Date(hist.lastDate + 'T12:00:00').toLocaleDateString('pt-BR') : ''}
                  </p>
                  <p className="text-sm text-zinc-200">{lastSetsLabel}</p>
                </div>
              </div>
            )}

            {/* Tabela de séries */}
            <div className="flex-1">
              <div className="grid grid-cols-[32px_1fr_1fr_44px] gap-2 mb-3">
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest">Set</span>
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest">Reps</span>
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest">Carga (kg)</span>
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest text-right">Feito</span>
              </div>
              <div className="space-y-0">
                {sets.map((set, si) => {
                  const isNewPR = set.done && hist.pr && parseFloat(set.carga) > hist.pr
                  const prevSet = hist.lastSets?.[si]
                  const prevHint = prevSet?.done
                    ? [prevSet.carga && `${prevSet.carga}kg`, prevSet.repeticoes && `${prevSet.repeticoes} reps`].filter(Boolean).join(' × ')
                    : null

                  // Compara set concluído com o anterior
                  let progressColor = ''
                  if (set.done && prevSet?.done) {
                    const curW = parseFloat(set.carga) || 0
                    const prevW = parseFloat(prevSet.carga) || 0
                    const curR = parseInt(set.repeticoes) || 0
                    const prevR = parseInt(prevSet.repeticoes) || 0
                    if (curW > prevW || (curW >= prevW && curR > prevR)) progressColor = 'border-l-2 border-l-green-600'
                    else if (curW === prevW && curR === prevR) progressColor = 'border-l-2 border-l-zinc-600'
                    else progressColor = 'border-l-2 border-l-red-700'
                  }

                  return (
                    <div key={si} className="border-t border-zinc-800">
                    <div className={`grid grid-cols-[32px_1fr_1fr_44px] gap-2 items-center py-2 pl-1 ${set.done ? `opacity-60 ${progressColor}` : ''}`}>
                      <span className="font-heading font-bold text-zinc-400 text-sm">
                        {String(si + 1).padStart(2, '0')}
                      </span>
                      <input
                        type="number"
                        min="0"
                        placeholder={ex.repeticoes || '0'}
                        value={set.repeticoes}
                        disabled={set.done || viewOnly}
                        onChange={e => updateSet(currentIdx, si, 'repeticoes', e.target.value)}
                        className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="0"
                          value={set.carga}
                          disabled={set.done || viewOnly}
                          onChange={e => updateSet(currentIdx, si, 'carga', e.target.value)}
                          className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        {isNewPR && (
                          <span className="absolute -top-2 -right-1 text-[9px] bg-yellow-500 text-black font-black px-1 rounded uppercase">PR!</span>
                        )}
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => !viewOnly && markDone(currentIdx, si)}
                          disabled={set.done || viewOnly}
                          className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-all disabled:cursor-not-allowed ${
                            set.done ? 'bg-red-600 border-red-600' : 'border-zinc-700 hover:border-red-500 hover:bg-red-600/10'
                          }`}
                        >
                          {set.done && (
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    {/* Hint do valor anterior — só em séries pendentes */}
                    {!set.done && prevHint && (
                      <p className="text-[10px] text-zinc-600 pl-9 pb-1">Último: {prevHint}</p>
                    )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Navegação */}
            <div className="flex justify-between items-center mt-6 pt-5 border-t border-zinc-800">
              <button
                onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                disabled={currentIdx === 0}
                className="px-4 md:px-5 py-3 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-heading font-bold uppercase tracking-widest text-xs rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              {viewOnly ? (
                isLast ? (
                  <span className="text-xs text-zinc-500 uppercase tracking-widest">Fim da lista</span>
                ) : (
                  <button
                    onClick={() => setCurrentIdx(i => Math.min(flatEx.length - 1, i + 1))}
                    className="px-5 md:px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-heading font-bold uppercase tracking-widest text-sm rounded-xl transition-colors flex items-center gap-2"
                  >
                    Próximo
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )
              ) : isLast ? (
                <button
                  onClick={finish}
                  disabled={finishing}
                  className="px-5 md:px-6 py-3 bg-green-700 hover:bg-green-600 text-white font-heading font-bold uppercase tracking-widest text-sm rounded-xl transition-colors disabled:opacity-50"
                >
                  {finishing ? 'Salvando...' : 'Finalizar treino'}
                </button>
              ) : (
                <button
                  onClick={() => setCurrentIdx(i => Math.min(flatEx.length - 1, i + 1))}
                  className="px-5 md:px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-heading font-bold uppercase tracking-widest text-sm rounded-xl transition-colors flex items-center gap-2"
                >
                  Próximo
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
