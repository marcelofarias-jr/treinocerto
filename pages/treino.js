import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { formatConfigs, muscleGroupLabels } from '../lib/workoutConfig'
import { todayFortaleza } from '../lib/dates'
import { formatDuration } from '../lib/format'
import { primeAudio } from '../lib/beep'
import { apiFetch } from '../lib/api'
import { useToast } from '../components/ToastProvider'
import { recommendedDay, countExercises, countSeries } from '../lib/workoutStats'

function buildHistory(sessions) {
  // Guarda contra resposta que não é lista (ex.: {error} de um 401): sem isso
  // o spread abaixo lança "object is not iterable" e derruba a tela.
  const sorted = [...(Array.isArray(sessions) ? sessions : [])]
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
      <span className="font-heading font-bold text-white text-sm tracking-widest">{formatDuration(seconds)}</span>
    </div>
  )
}

function RestTimerWidget({ endTime, totalSeconds, onDone }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
  )
  const doneFired = useRef(false)

  // Sem alarme aqui: quem beepa e vibra é o Header, que está montado em todas
  // as páginas. Dois donos = dois beeps sobrepostos.
  useEffect(() => {
    function update() {
      setRemaining(Math.max(0, Math.ceil((endTime - Date.now()) / 1000)))
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
  const urgent = remaining > 0 && remaining <= 5

  return (
    <div
      className="fixed z-50 right-4"
      style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}
    >
      <div className={`bg-[#1a1a1a] border ${urgent ? 'border-red-500' : 'border-zinc-700'} rounded-xl px-3 pt-2 pb-2.5 shadow-xl min-w-[96px]`}>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold">Descanso</span>
          <button
            onClick={onDone}
            className="text-zinc-600 hover:text-zinc-400 transition-colors leading-none"
            aria-label="Pular descanso"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className={`font-heading font-black text-2xl leading-none tracking-widest text-center ${urgent ? 'text-red-500' : 'text-white'}`}>
          {formatDuration(remaining)}
        </p>
        <div className="h-0.5 bg-zinc-800 rounded-full mt-2 overflow-hidden">
          <div className="h-0.5 bg-red-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}

// Acima disso a sessão em andamento é tratada como abandonada.
const MAX_SESSION_MS = 12 * 60 * 60 * 1000

// Séries iniciais de um exercício: repete o que foi feito da última vez.
function buildInitialSets(exs, history, keepDone = false) {
  const init = {}
  exs.forEach((ex, i) => {
    const n = Math.max(1, parseInt(ex.series) || 3)
    const prev = history[ex.name]?.lastSets || []
    init[i] = Array.from({ length: n }, (_, si) => ({
      carga: prev[si]?.carga || ex.carga || '',
      repeticoes: prev[si]?.repeticoes || ex.repeticoes || '',
      done: keepDone ? (prev[si]?.done || false) : false,
    }))
  })
  return init
}

function clearWorkoutStorage() {
  localStorage.removeItem('workoutStartTime')
  localStorage.removeItem('workoutPlanId')
  localStorage.removeItem('workoutDayId')
  localStorage.removeItem('workoutCurrentIdx')
  localStorage.removeItem('workoutSetsData')
}

export default function Treino() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const toast = useToast()

  const [workout, setWorkout] = useState(null)
  const [allWorkouts, setAllWorkouts] = useState([])
  const [allSessions, setAllSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDayId, setSelectedDayId] = useState(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [setsData, setSetsData] = useState({})
  const [elapsed, setElapsed] = useState(0)
  const [restEndTime, setRestEndTime] = useState(null)
  const [restTotal, setRestTotal] = useState(60)
  const [restingSet, setRestingSet] = useState(null)
  const [finishing, setFinishing] = useState(false)
  const [summary, setSummary] = useState(null)
  const [exerciseHistory, setExerciseHistory] = useState({})
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [previewDay, setPreviewDay] = useState(null)
  const [viewOnly, setViewOnly] = useState(false)
  const [standalone, setStandalone] = useState(false)
  const [inProgress, setInProgress] = useState(null) // { dayId, label } da sessão viva
  const [sessionNotes, setSessionNotes] = useState('')
  const listRef = useRef(null)
  const setsDataInitialized = useRef(false)
  const completePrompted = useRef(false)

  // Carrega o treino do usuário e restaura sessão ativa se houver
  useEffect(() => {
    if (!session || !router.isReady) return
    // ?workout=<id> treina um plano salvo qualquer, sem mudar qual é o ativo.
    const requestedId = router.query.workout != null ? String(router.query.workout) : null
    Promise.all([
      apiFetch('/api/workouts'),
      apiFetch('/api/sessions'),
    ]).catch(err => {
      // Sem isso, uma sessão expirada virava a tela "Nenhum treino encontrado".
      toast(err.message, 'error')
      setLoading(false)
      return [[], []]
    }).then(([ws, ss]) => {
      const list = Array.isArray(ws) ? ws : []
      // Treino ativo marcado; senão, o mais recente (cobre "só há um treino").
      const activeW = list.length > 0 ? (list.find(x => x.isActive) || list[list.length - 1]) : null
      // Sessão em andamento manda: continua no plano dela, ignorando a URL.
      const pickId = localStorage.getItem('workoutStartTime')
        ? localStorage.getItem('workoutPlanId')
        : requestedId
      const w = (pickId && list.find(x => String(x.id) === pickId)) || activeW
      setStandalone(!!w && !!activeW && w.id !== activeW.id)
      const sessions = Array.isArray(ss) ? ss : []
      setAllWorkouts(list)
      setWorkout(w)
      setAllSessions(sessions)
      setLoading(false)

      const startTime = localStorage.getItem('workoutStartTime')
      const savedDayId = localStorage.getItem('workoutDayId')
      if (!startTime || !savedDayId) return

      // Treino nenhum dura 12h: passou disso, foi abandonado. Sem esse corte o
      // cronômetro segue contando por dias e a duração salva vira lixo.
      if (Date.now() - parseInt(startTime) > MAX_SESSION_MS) { clearWorkoutStorage(); return }

      // Verifica se o dayId ainda existe no treino restaurado
      const savedDay = w?.days?.find(d => d.dayId === savedDayId)
      if (!savedDay) { clearWorkoutStorage(); return }

      setInProgress({ dayId: savedDayId, label: savedDay.label })
      setSelectedDayId(savedDayId)
      setCurrentIdx(parseInt(localStorage.getItem('workoutCurrentIdx') || '0'))

      // Tenta restaurar setsData do localStorage
      let restoredSets = null
      try {
        const saved = localStorage.getItem('workoutSetsData')
        if (saved) restoredSets = JSON.parse(saved)
      } catch (_) {}

      const hasRestoredSets = restoredSets && Object.keys(restoredSets).length > 0
      const history = buildHistory(sessions)
      setExerciseHistory(history)

      if (hasRestoredSets) {
        setSetsData(restoredSets)
      } else {
        // setsData não estava salvo — inicializa a partir do treino + histórico
        const exs = savedDay.exercises.flatMap(mg =>
          mg.exercises.map(ex => typeof ex === 'string' ? { name: ex } : ex)
        )
        const init = buildInitialSets(exs, history)
        setSetsData(init)
        localStorage.setItem('workoutSetsData', JSON.stringify(init))
      }
      setsDataInitialized.current = true
    })
  }, [session, router.isReady, router.query.workout])

  // Restaura timer de descanso ativo ao retornar à página
  useEffect(() => {
    const savedEnd = localStorage.getItem('restTimerEnd')
    if (!savedEnd) return
    const rem = Math.ceil((parseInt(savedEnd) - Date.now()) / 1000)
    if (rem > 0) {
      setRestEndTime(parseInt(savedEnd))
      setRestTotal(parseInt(localStorage.getItem('restTimerTotal') || '60'))
      try {
        const savedSet = JSON.parse(localStorage.getItem('restTimerSet') || 'null')
        if (savedSet) setRestingSet(savedSet)
      } catch (_) {}
    } else {
      localStorage.removeItem('restTimerEnd')
      localStorage.removeItem('restTimerTotal')
      localStorage.removeItem('restTimerSet')
    }
  }, [])

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
    if (!setsDataInitialized.current || viewOnly) return
    if (!localStorage.getItem('workoutStartTime')) return
    localStorage.setItem('workoutSetsData', JSON.stringify(setsData))
  }, [setsData])

  useEffect(() => {
    if (viewOnly) return
    if (!localStorage.getItem('workoutStartTime')) return
    localStorage.setItem('workoutCurrentIdx', String(currentIdx))
  }, [currentIdx])

  /*
   * Última série marcada: propõe encerrar sozinho.
   *
   * Dispara uma vez por conclusão. Se o usuário escolher "Continuar" não
   * insiste; se desmarcar uma série e completar de novo, propõe outra vez.
   */
  useEffect(() => {
    if (viewOnly || summary || !selectedDayId) return
    const sets = Object.values(setsData)
    const planned = sets.reduce((a, x) => a + x.length, 0)
    const done = sets.reduce((a, x) => a + x.filter(k => k.done).length, 0)

    if (planned === 0 || done < planned) { completePrompted.current = false; return }
    if (completePrompted.current) return
    completePrompted.current = true

    // Pequena folga para o check da última série registrar na tela antes do modal.
    const t = setTimeout(() => setShowFinishModal(true), 700)
    return () => clearTimeout(t)
  }, [setsData, viewOnly, summary, selectedDayId])

  if (status === 'loading' || loading) {
    return <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center text-zinc-500">Carregando...</div>
  }
  if (!session) { router.push('/'); return null }

  const recommendedDayId = recommendedDay(workout, allSessions)?.dayId ?? null
  const openDay = selectedDayId != null ? workout?.days?.find(d => d.dayId === selectedDayId) : null
  // Dia sem exercício não abre: flatEx vazio deixava `ex` undefined e quebrava
  // a tela. Sem dia válido, a rota cai na seleção.
  const day = openDay?.exercises?.some(mg => mg.exercises?.length) ? openDay : null
  // Ativo efetivo: o marcado ou, na ausência, o mais recente (mesma regra da API).
  const activeWorkoutId = allWorkouts.find(w => w.isActive)?.id ?? allWorkouts[allWorkouts.length - 1]?.id
  const otherWorkouts = allWorkouts.filter(w => w.id !== workout?.id)
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

    // Carrega histórico de sessões. Se falhar, o treino começa sem
    // pré-preenchimento em vez de travar quem já está na academia.
    let history = {}
    try {
      history = buildHistory(await apiFetch('/api/sessions'))
    } catch (err) {
      toast(`${err.message} O treino começa sem as cargas da última vez.`, 'error')
    }
    setExerciseHistory(history)

    // Inicializa sets pré-preenchidos com dados do último treino
    const init = buildInitialSets(exs, history)

    setsDataInitialized.current = true
    setSetsData(init)
    setInProgress({ dayId, label: d.label })
    setSelectedDayId(dayId)
    setCurrentIdx(0)
    localStorage.setItem('workoutStartTime', String(Date.now()))
    localStorage.setItem('workoutPlanId', String(workout.id))
    localStorage.setItem('workoutDayId', dayId)
    localStorage.setItem('workoutCurrentIdx', '0')
    localStorage.setItem('workoutSetsData', JSON.stringify(init))
  }

  // Volta para a sessão em andamento relendo o estado persistido — assim um
  // desvio pelo "só visualizar" não contamina os dados do treino em curso.
  function resumeInProgress() {
    if (!inProgress) return
    try {
      const saved = JSON.parse(localStorage.getItem('workoutSetsData') || 'null')
      if (saved) setSetsData(saved)
    } catch (_) {}
    setViewOnly(false)
    setCurrentIdx(parseInt(localStorage.getItem('workoutCurrentIdx') || '0'))
    setSelectedDayId(inProgress.dayId)
  }

  async function viewDay(dayId) {
    const d = workout.days.find(d => d.dayId === dayId)
    const exs = d.exercises.flatMap(mg =>
      mg.exercises.map(ex => typeof ex === 'string' ? { name: ex } : ex)
    )
    let history = {}
    try {
      history = buildHistory(await apiFetch('/api/sessions'))
    } catch (err) {
      toast(err.message, 'error')
    }
    setExerciseHistory(history)

    setSetsData(buildInitialSets(exs, history, true))
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

  function clearRestTimer() {
    setRestEndTime(null)
    setRestingSet(null)
    localStorage.removeItem('restTimerEnd')
    localStorage.removeItem('restTimerTotal')
    localStorage.removeItem('restTimerSet')
  }

  // Alterna a série: marcar inicia o descanso, desmarcar reabre os campos e
  // cancela o descanso daquela série (toque errado tem volta).
  function toggleDone(ei, si) {
    const wasDone = !!setsData[ei]?.[si]?.done

    setSetsData(prev => {
      const sets = [...(prev[ei] || [])]
      if (!sets[si]) return prev
      sets[si] = { ...sets[si], done: !wasDone }
      return { ...prev, [ei]: sets }
    })

    if (wasDone) {
      if (restingSet?.ei === ei && restingSet?.si === si) clearRestTimer()
      return
    }

    // Toque do usuário: bom momento para acordar o áudio antes do alarme.
    primeAudio()

    // Se esta série fecha o treino, não inicia descanso: o encerramento é
    // proposto em seguida e um cronômetro rodando atrás do modal só atrapalha.
    const fechaOTreino = Object.entries(setsData).every(([k, arr]) =>
      arr.every((st, i) => st.done || (String(k) === String(ei) && i === si))
    )
    if (fechaOTreino) return

    const ds = parseInt(flatEx[ei]?.descanso) || 60
    if (ds > 0) {
      const end = Date.now() + ds * 1000
      setRestEndTime(end)
      setRestTotal(ds)
      setRestingSet({ ei, si })
      localStorage.setItem('restTimerEnd', String(end))
      localStorage.setItem('restTimerTotal', String(ds))
      localStorage.setItem('restTimerSet', JSON.stringify({ ei, si }))
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
    setsDataInitialized.current = false
    clearWorkoutStorage()
    setInProgress(null)
    setSelectedDayId(null)
    setSetsData({})
    setCurrentIdx(0)
    setElapsed(0)
    router.push('/')
  }

  async function finish() {
    // Guard de último nível: nada de sessão vazia no histórico, mesmo que a UI
    // deixe passar por algum caminho novo.
    if (getStats().doneSets === 0) { setShowFinishModal(false); return }
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

    // Grava PRIMEIRO, limpa depois. Na ordem inversa, uma falha de rede — que
    // na academia é comum — apagava o treino do localStorage sem ter salvado.
    try {
      await apiFetch('/api/sessions', {
        json: {
          date: todayFortaleza(),
          workoutId: workout.id,
          dayId: day.dayId,
          dayLabel: day.label,
          duration: finalElapsed,
          exercisesData,
          notes: sessionNotes.trim() || null,
        },
      })
    } catch (err) {
      setFinishing(false)
      toast(`${err.message} Seu treino continua aqui, nada foi perdido.`, 'error')
      return
    }

    clearWorkoutStorage()

    const plannedSets = Object.values(setsData).reduce((a, x) => a + x.length, 0)

    setInProgress(null)
    setSummary({
      duration: finalElapsed,
      totalVolume,
      totalSetsCompleted,
      totalReps,
      exSummaries,
      allComplete: plannedSets > 0 && totalSetsCompleted === plannedSets,
      plannedSets,
    })
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
              {summary.allComplete ? (
                <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21h8m-4-4v4m5-17v4a5 5 0 01-10 0V4h10zm0 2h2a2 2 0 010 4h-2m-10-4H5a2 2 0 000 4h2" />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <h1 className="font-heading font-black text-3xl uppercase text-white">
                {summary.allComplete ? 'Treino completo!' : 'Treino concluído!'}
              </h1>
              {summary.allComplete && (
                <span className="px-1.5 py-0.5 bg-yellow-500 text-black text-[10px] font-black uppercase tracking-widest rounded flex-shrink-0">
                  100%
                </span>
              )}
            </div>
            <p className="text-zinc-400 text-sm">{day?.label} · {formatDuration(summary.duration, "short")}</p>
            {summary.allComplete && (
              <p className="text-green-400 text-xs mt-2">
                Todas as {summary.plannedSets} séries planejadas, sem deixar nenhuma para trás.
              </p>
            )}
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

          {/* Sessão em andamento: volta pra ela sem reiniciar o cronômetro */}
          {inProgress && (
            <button
              onClick={resumeInProgress}
              className="w-full flex items-center gap-3 p-4 mb-5 bg-amber-950/20 border border-amber-700 hover:border-amber-500 rounded-2xl text-left transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-amber-400 uppercase tracking-widest font-bold">Em andamento · {formatDuration(elapsed)}</p>
                <p className="font-heading font-bold text-white text-sm uppercase truncate">{inProgress.label}</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 flex-shrink-0">Continuar</span>
            </button>
          )}

          {standalone && (
            <div className="flex items-start gap-3 p-3 mb-5 bg-amber-950/20 border border-amber-800 rounded-xl">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-amber-300">
                  <span className="font-bold uppercase tracking-widest">Só hoje</span>
                  {' · '}
                  {formatConfigs[workout.format]?.name || workout.format}
                </p>
                <p className="text-[11px] text-amber-400/70 mt-0.5">
                  A sessão conta normalmente; seu treino ativo continua sendo o outro.
                </p>
              </div>
              <button
                onClick={() => router.push('/treino')}
                className="flex-shrink-0 text-[10px] font-bold uppercase tracking-widest text-amber-400 hover:text-amber-300 transition-colors"
              >
                Usar ativo
              </button>
            </div>
          )}
          <div className="space-y-3">
            {(workout?.days || []).map(d => {
              const total = countExercises(d)
              // Dia sem exercício não abre: flatEx vazio quebrava a tela.
              const isEmpty = total === 0
              const isRecommended = !isEmpty && d.dayId === recommendedDayId
              return (
                <button key={d.dayId} onClick={() => !isEmpty && setPreviewDay(d)}
                  disabled={isEmpty}
                  className={`w-full border rounded-2xl p-5 text-left transition-all group relative ${
                    isEmpty
                      ? 'bg-[#141414] border-zinc-800 border-dashed cursor-not-allowed'
                      : isRecommended
                        ? 'bg-red-950/20 border-red-700 hover:border-red-500'
                        : 'bg-[#1a1a1a] border-zinc-800 hover:border-zinc-600'
                  }`}>
                  {isEmpty && (
                    <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 bg-zinc-800 text-zinc-500 rounded-full uppercase tracking-widest">
                      Incompleto
                    </span>
                  )}
                  {isRecommended && (
                    <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 bg-red-600 text-white rounded-full uppercase tracking-widest">
                      Hoje
                    </span>
                  )}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-xs uppercase tracking-widest mb-1 ${isRecommended ? 'text-red-400' : 'text-zinc-400'}`}>
                        Dia {d.dayId}
                      </p>
                      <p className={`font-heading font-black text-xl uppercase ${isEmpty ? 'text-zinc-500' : 'text-white'}`}>{d.label}</p>
                      <p className="text-zinc-300 text-xs mt-1">
                        {isEmpty ? 'Sem exercícios — edite o plano' : `${total} exercícios`}
                      </p>
                    </div>
                    <svg className={`w-5 h-5 transition-colors flex-shrink-0 ml-12 ${isEmpty ? 'text-zinc-700' : isRecommended ? 'text-red-500 group-hover:text-red-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              )
            })}

            {!workout && (
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full py-3 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white text-xs font-semibold uppercase tracking-wide rounded-xl transition-colors"
              >
                Criar um plano de treino
              </button>
            )}
          </div>

          {/* Fazer outro treino salvo só neste dia, sem trocar o ativo.
              Escondido com treino em andamento: trocar de plano ali seria ignorado. */}
          {!inProgress && otherWorkouts.length > 0 && (
            <div className="mt-8">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
                Fazer outro treino só hoje
              </p>
              <div className="space-y-2">
                {otherWorkouts.map(w => {
                  const dias = w.days?.length || 0
                  const series = countSeries(w.days)
                  return (
                    <button
                      key={w.id}
                      onClick={() => router.push(`/treino?workout=${w.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-[#1a1a1a] border border-zinc-800 hover:border-amber-700 rounded-xl text-left transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-heading font-bold text-white text-sm uppercase truncate">
                            {formatConfigs[w.format]?.name || w.format}
                          </p>
                          {w.id === activeWorkoutId && (
                            <span className="px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-black uppercase tracking-widest rounded flex-shrink-0">
                              Ativo
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          {dias} {dias === 1 ? 'dia' : 'dias'} · {series} séries
                        </p>
                      </div>
                      <svg className="w-4 h-4 text-zinc-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
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
                      {countExercises(previewDay)} exercícios
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
                <div className="space-y-1.5">
                  {previewDay.exercises
                    .flatMap(mg => mg.exercises.map(ex => ({
                      ...(typeof ex === 'string' ? { name: ex } : ex),
                      muscleGroup: mg.muscleGroup,
                    })))
                    .map((ex, i) => (
                      <div key={i} className="flex items-center gap-3 py-1.5 border-b border-zinc-800/50 last:border-0">
                        <span className="text-xs font-mono text-zinc-600 w-4 text-right flex-shrink-0">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block leading-none">
                            {muscleGroupLabels[ex.muscleGroup] || ex.muscleGroup}
                          </span>
                          <span className="text-sm text-zinc-200">{ex.name}</span>
                        </div>
                        {(ex.series || ex.repeticoes) && (
                          <span className="text-xs text-zinc-500 flex-shrink-0">
                            {ex.series && `${ex.series}×`}{ex.repeticoes && `${ex.repeticoes}`}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
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
  const allDone = totalSets > 0 && doneSets === totalSets
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
        <RestTimerWidget endTime={restEndTime} totalSeconds={restTotal} onDone={clearRestTimer} />
      )}

      {showFinishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/75" onClick={() => setShowFinishModal(false)} />
          <div className="relative bg-[#1a1a1a] border border-zinc-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-900/40 border border-green-700 rounded-xl flex items-center justify-center flex-shrink-0">
                {allDone ? (
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21h8m-4-4v4m5-17v4a5 5 0 01-10 0V4h10zm0 2h2a2 2 0 010 4h-2m-10-4H5a2 2 0 000 4h2" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-black text-xl uppercase text-white leading-none">
                    {allDone ? 'Parabéns!' : 'Encerrar treino'}
                  </h3>
                  {allDone && (
                    <span className="px-1.5 py-0.5 bg-yellow-500 text-black text-[9px] font-black uppercase tracking-widest rounded flex-shrink-0">
                      100%
                    </span>
                  )}
                </div>
                <p className="text-zinc-400 text-xs mt-0.5">Tempo: {formatDuration(elapsed)}</p>
              </div>
            </div>
            {allDone ? (
              <div className="mb-5">
                <p className="text-zinc-200 text-sm mb-4">
                  Você fechou <strong className="text-white font-semibold">todas as {totalSets} séries</strong>
                  {' '}dos {total} {total === 1 ? 'exercício' : 'exercícios'} de hoje. Nada ficou para trás.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#232323] border border-zinc-800 rounded-xl p-2.5 text-center">
                    <p className="font-heading font-black text-xl text-white leading-none">{total}</p>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1">Exercícios</p>
                  </div>
                  <div className="bg-[#232323] border border-zinc-800 rounded-xl p-2.5 text-center">
                    <p className="font-heading font-black text-xl text-white leading-none">{totalSets}</p>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1">Séries</p>
                  </div>
                  <div className="bg-[#232323] border border-zinc-800 rounded-xl p-2.5 text-center">
                    <p className="font-heading font-black text-xl text-white leading-none">{formatDuration(elapsed, 'short')}</p>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1">Duração</p>
                  </div>
                </div>
              </div>
            ) : doneSets === 0 ? (
              <div className="flex items-start gap-2.5 p-3 mb-4 bg-amber-950/25 border border-amber-800 rounded-xl">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-amber-300">
                  Nenhuma série foi marcada como feita. Salvar assim criaria um treino vazio no
                  histórico, contando na sua sequência sem nada registrado.
                </p>
              </div>
            ) : (
              <p className="text-zinc-300 text-sm mb-4">
                Os dados das séries completadas serão salvos. Séries não marcadas como feitas serão ignoradas.
              </p>
            )}
            {doneSets > 0 && (
              <textarea
                value={sessionNotes}
                onChange={e => setSessionNotes(e.target.value)}
                placeholder="Anotação da sessão (opcional) — como você se sentiu, observações..."
                rows={3}
                className="w-full mb-5 resize-none"
              />
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowFinishModal(false)}
                className="flex-1 py-2.5 border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-semibold uppercase tracking-wide text-xs rounded-xl transition-colors"
              >
                {allDone ? 'Ainda não' : 'Continuar'}
              </button>
              {doneSets === 0 ? (
                <button
                  onClick={() => { setShowFinishModal(false); setShowCancelConfirm(true) }}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-heading font-bold uppercase tracking-widest text-sm rounded-xl transition-colors"
                >
                  Descartar
                </button>
              ) : (
                <button
                  onClick={() => { setShowFinishModal(false); finish() }}
                  disabled={finishing}
                  className="flex-1 py-2.5 bg-green-700 hover:bg-green-600 text-white font-heading font-bold uppercase tracking-widest text-sm rounded-xl transition-colors disabled:opacity-50"
                >
                  {finishing ? 'Salvando...' : allDone ? 'Encerrar treino' : 'Salvar treino'}
                </button>
              )}
            </div>

            {/* Opção destrutiva: cancelar sem salvar */}
            {doneSets > 0 && (
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
            )}
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
                <p className="text-zinc-400 text-xs mt-0.5">Tempo: {formatDuration(elapsed)}</p>
              </div>
            </div>
            <p className="text-zinc-300 text-sm mb-6">
              {doneSets === 0
                ? 'Nenhuma série foi registrada, então nada se perde. O treino não entra no histórico.'
                : `${doneSets} ${doneSets === 1 ? 'série registrada será perdida' : 'séries registradas serão perdidas'}. O treino não será salvo no histórico.`}
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
            onClick={() => { setSelectedDayId(null); setViewOnly(false) }}
            className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 uppercase tracking-widest transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar
          </button>
          <div className="flex items-center gap-3">
            {standalone && (
              <span className="px-2.5 py-1 bg-amber-500/15 border border-amber-700 rounded-lg text-[10px] text-amber-400 font-bold uppercase tracking-widest">
                Só hoje
              </span>
            )}
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
                {[...new Set(day.exercises.map(mg => (muscleGroupLabels[mg.muscleGroup] || mg.muscleGroup).toUpperCase()))].join(' · ')}
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

                  const isResting = !!restEndTime && restingSet?.ei === currentIdx && restingSet?.si === si

                  return (
                    <div key={si} className="border-t border-zinc-800">
                    <div className={`grid grid-cols-[32px_1fr_1fr_44px] gap-2 items-center py-2 pl-1 ${set.done ? `opacity-60 ${progressColor}` : ''}`}>
                      <span className="font-heading font-bold text-zinc-400 text-sm">
                        {String(si + 1).padStart(2, '0')}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
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
                          inputMode="decimal"
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
                          onClick={() => !viewOnly && toggleDone(currentIdx, si)}
                          disabled={viewOnly}
                          title={set.done ? 'Toque de novo para desmarcar' : 'Concluir série'}
                          className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-all disabled:cursor-not-allowed ${
                            set.done ? 'bg-red-600 border-red-600 hover:bg-red-700' : 'border-zinc-700 hover:border-red-500 hover:bg-red-600/10'
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
                    {/* Indicador de descanso ativo para esta série */}
                    {isResting && (
                      <div className="flex items-center gap-1.5 pl-9 pb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                        <span className="text-[10px] text-red-400 uppercase tracking-widest font-semibold">Descansando</span>
                      </div>
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
