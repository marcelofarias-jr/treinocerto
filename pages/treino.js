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

function RestTimerOverlay({ seconds, onDone }) {
  const [remaining, setRemaining] = useState(seconds)
  const beeped = useRef(false)

  useEffect(() => {
    if (remaining <= 0) {
      if (!beeped.current) { beeped.current = true; playBeep() }
      const t = setTimeout(onDone, 800)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining])

  const pct = Math.round(((seconds - remaining) / seconds) * 100)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
      <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-10 text-center max-w-sm w-full">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-6">Descanso</p>
        <p className={`font-heading font-black text-8xl leading-none mb-6 transition-colors ${remaining <= 5 ? 'text-red-500' : 'text-white'}`}>
          {fmt(remaining)}
        </p>
        <div className="h-1.5 bg-zinc-800 rounded-full mb-8 overflow-hidden">
          <div className="h-1.5 bg-red-600 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
        </div>
        <button onClick={onDone} className="text-zinc-500 hover:text-zinc-300 text-xs uppercase tracking-widest transition-colors">
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
  const [restSeconds, setRestSeconds] = useState(null)
  const [finishing, setFinishing] = useState(false)
  const [done, setDone] = useState(false)
  const [exerciseHistory, setExerciseHistory] = useState({})
  const [showFinishModal, setShowFinishModal] = useState(false)
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
        try {
          const saved = localStorage.getItem('workoutSetsData')
          if (saved) setSetsData(JSON.parse(saved))
        } catch (_) {}

        // Busca histórico para o dia restaurado
        fetch(`/api/sessions?email=${session.user.email}`)
          .then(r => r.json())
          .then(sessions => setExerciseHistory(buildHistory(sessions)))
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
          <p className="text-zinc-500 mb-5">Nenhum treino encontrado.</p>
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
    if (ds > 0) setRestSeconds(ds)
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

  async function finish() {
    setFinishing(true)
    const start = localStorage.getItem('workoutStartTime')
    const finalElapsed = start ? Math.floor((Date.now() - parseInt(start)) / 1000) : elapsed
    clearWorkoutStorage()

    const exercisesData = flatEx.map((ex, i) => ({
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      sets: setsData[i] || [],
    }))

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
      }),
    })
    setElapsed(finalElapsed)
    setFinishing(false)
    setDone(true)
  }

  /* ── Tela de conclusão ── */
  if (done) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center px-4">
        <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-8 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-green-900/40 border border-green-700 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-heading font-black text-3xl uppercase text-white mb-1">Treino concluído!</h2>
          <p className="text-zinc-500 text-sm mb-1">Duração: <span className="text-white font-semibold">{fmt(elapsed)}</span></p>
          <p className="text-zinc-500 text-sm mb-6">Ótimo trabalho. Continue assim!</p>
          <button onClick={() => router.push('/')} className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-heading font-bold uppercase tracking-widest rounded-xl transition-colors">
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
          <p className="text-xs text-zinc-600 uppercase tracking-widest mb-2">Treinar</p>
          <h1 className="font-heading font-black text-4xl uppercase text-white mb-1">Qual dia é hoje?</h1>
          <p className="text-zinc-500 text-sm mb-6">Escolha o dia do treino que você vai realizar.</p>
          <div className="space-y-3">
            {workout.days.map(d => {
              const total = d.exercises.reduce((a, mg) => a + mg.exercises.length, 0)
              return (
                <button key={d.dayId} onClick={() => startDay(d.dayId)}
                  className="w-full bg-[#1a1a1a] border border-zinc-800 hover:border-zinc-600 rounded-2xl p-5 text-left transition-all group">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-600 uppercase tracking-widest mb-1">Dia {d.dayId}</p>
                      <p className="font-heading font-black text-xl uppercase text-white">{d.label}</p>
                      <p className="text-zinc-500 text-xs mt-1">{total} exercícios</p>
                    </div>
                    <svg className="w-5 h-5 text-zinc-700 group-hover:text-zinc-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
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
    <div className="min-h-screen bg-[#0f0f0f]">
      {restSeconds && (
        <RestTimerOverlay seconds={restSeconds} onDone={() => setRestSeconds(null)} />
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
                <p className="text-zinc-500 text-xs mt-0.5">Tempo: {fmt(elapsed)}</p>
              </div>
            </div>
            <p className="text-zinc-400 text-sm mb-6">
              Os dados das séries completadas serão salvos. Series não marcadas como feitas serão ignoradas.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowFinishModal(false)}
                className="flex-1 py-2.5 border border-zinc-700 hover:border-zinc-500 text-zinc-400 font-semibold uppercase tracking-wide text-xs rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { setShowFinishModal(false); finish() }}
                disabled={finishing}
                className="flex-1 py-2.5 bg-green-700 hover:bg-green-600 text-white font-heading font-bold uppercase tracking-widest text-sm rounded-xl transition-colors disabled:opacity-50"
              >
                {finishing ? 'Salvando...' : 'Finalizar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => { setSelectedDayId(null); clearWorkoutStorage(); setElapsed(0) }}
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 uppercase tracking-widest transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar
          </button>
          <div className="flex items-center gap-3">
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
          </div>
        </div>

        {/* Hero */}
        <div className="relative bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-6 mb-5 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-900/20 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 mr-6">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Treino de hoje · {day.dayId}</p>
              <h1 className="font-heading font-black text-3xl md:text-4xl uppercase text-white leading-tight">
                {day.exercises.map(mg => (muscleGroupLabels[mg.muscleGroup] || mg.muscleGroup).toUpperCase()).join(' · ')}
              </h1>
              <div className="flex items-center gap-5 mt-3">
                <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <svg className="w-3.5 h-3.5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
                  </svg>
                  {total} exercícios
                </span>
                <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <svg className="w-3.5 h-3.5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {totalSets} séries
                </span>
                <span className="flex items-center gap-1.5 text-xs text-zinc-500">
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

        {/* Split layout */}
        <div className="flex gap-4" style={{ minHeight: '420px' }}>
          {/* Esquerda: lista de exercícios */}
          <div ref={listRef} className="w-64 flex-shrink-0 space-y-2 overflow-y-auto max-h-[520px]">
            {flatEx.map((e, i) => {
              const { done: d, total: t } = getExProg(i)
              const active = i === currentIdx
              const h = exerciseHistory[e.name]
              const lastWeights = h?.lastSets?.filter(s => s.carga).map(s => s.carga) || []
              const lastWeightLabel = lastWeights.length ? lastWeights.join(' · ') + ' kg' : null
              return (
                <button key={i} onClick={() => setCurrentIdx(i)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    active ? 'bg-red-900/40 border-red-600' : 'bg-[#1a1a1a] border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded flex-shrink-0 flex items-center justify-center text-xs font-black ${
                      active ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate leading-snug ${active ? 'text-white' : 'text-zinc-300'}`}>
                        {e.name}
                      </p>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wide mt-0.5">
                        {(muscleGroupLabels[e.muscleGroup] || e.muscleGroup).toUpperCase()} · {d}/{t} séries
                      </p>
                      {lastWeightLabel && (
                        <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{lastWeightLabel}</p>
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
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">
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
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">
                    Último treino · {hist.lastDate ? new Date(hist.lastDate + 'T12:00:00').toLocaleDateString('pt-BR') : ''}
                  </p>
                  <p className="text-sm text-zinc-300">{lastSetsLabel}</p>
                </div>
              </div>
            )}

            {/* Tabela de séries */}
            <div className="flex-1">
              <div className="grid grid-cols-[40px_1fr_1fr_48px] gap-3 mb-3">
                <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Set</span>
                <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Carga (kg)</span>
                <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Reps</span>
                <span className="text-[10px] text-zinc-600 uppercase tracking-widest text-right">Feito</span>
              </div>
              <div className="space-y-2">
                {sets.map((set, si) => {
                  const isNewPR = set.done && hist.pr && parseFloat(set.carga) > hist.pr
                  return (
                    <div key={si} className={`grid grid-cols-[40px_1fr_1fr_48px] gap-3 items-center py-2 border-t border-zinc-800 ${set.done ? 'opacity-60' : ''}`}>
                      <span className="font-heading font-bold text-zinc-500 text-sm">
                        {String(si + 1).padStart(2, '0')}
                      </span>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={set.carga}
                          disabled={set.done}
                          onChange={e => updateSet(currentIdx, si, 'carga', e.target.value)}
                          className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        {isNewPR && (
                          <span className="absolute -top-2 -right-1 text-[9px] bg-yellow-500 text-black font-black px-1 rounded uppercase">PR!</span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder={ex.repeticoes || 'Reps'}
                        value={set.repeticoes}
                        disabled={set.done}
                        onChange={e => updateSet(currentIdx, si, 'repeticoes', e.target.value)}
                        className="disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={() => markDone(currentIdx, si)}
                          disabled={set.done}
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
                  )
                })}
              </div>
            </div>

            {/* Navegação */}
            <div className="flex justify-between items-center mt-6 pt-5 border-t border-zinc-800">
              <button
                onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                disabled={currentIdx === 0}
                className="px-5 py-2.5 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 font-heading font-bold uppercase tracking-widest text-xs rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              {isLast ? (
                <button
                  onClick={finish}
                  disabled={finishing}
                  className="px-6 py-2.5 bg-green-700 hover:bg-green-600 text-white font-heading font-bold uppercase tracking-widest text-sm rounded-xl transition-colors disabled:opacity-50"
                >
                  {finishing ? 'Salvando...' : 'Finalizar treino'}
                </button>
              ) : (
                <button
                  onClick={() => setCurrentIdx(i => Math.min(flatEx.length - 1, i + 1))}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-heading font-bold uppercase tracking-widest text-sm rounded-xl transition-colors flex items-center gap-2"
                >
                  Próximo exercício
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
