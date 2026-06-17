import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatConfigs } from '../lib/workoutConfig'

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function Calendar({ trainedDates }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const { year, month } = cursor
  const todayStr = new Date().toISOString().split('T')[0]
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthLabel = new Date(year, month).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

  const cells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      return { d, dateStr, trained: trainedDates.has(dateStr), isToday: dateStr === todayStr }
    }),
  ]

  function prev() {
    setCursor(c => ({
      year: c.month === 0 ? c.year - 1 : c.year,
      month: c.month === 0 ? 11 : c.month - 1,
    }))
  }
  function next() {
    setCursor(c => ({
      year: c.month === 11 ? c.year + 1 : c.year,
      month: c.month === 11 ? 0 : c.month + 1,
    }))
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <button onClick={prev} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="font-heading font-bold uppercase tracking-widest text-zinc-300 text-sm">{monthLabel}</p>
        <button onClick={next} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-widest text-zinc-600 mb-2">
        {WEEK_DAYS.map(d => <span key={d}>{d}</span>)}
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
        {cells.map((cell, i) => (
          <div key={i} className="flex items-center justify-center h-9">
            {cell && (
              <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-all
                ${cell.trained ? 'bg-red-600 text-white font-bold' : ''}
                ${cell.isToday && !cell.trained ? 'ring-2 ring-red-500 text-red-400' : ''}
                ${!cell.trained && !cell.isToday ? 'text-zinc-500' : ''}
              `}>
                {cell.d}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-5 mt-4 pt-4 border-t border-zinc-800">
        <span className="flex items-center gap-2 text-xs text-zinc-600">
          <span className="w-3 h-3 rounded-full bg-red-600 inline-block" /> Treino realizado
        </span>
        <span className="flex items-center gap-2 text-xs text-zinc-600">
          <span className="w-3 h-3 rounded-full ring-2 ring-red-500 inline-block" /> Hoje
        </span>
      </div>
    </div>
  )
}

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [workout, setWorkout] = useState(null)
  const [trainedDates, setTrainedDates] = useState(new Set())
  const [loadingData, setLoadingData] = useState(true)
  const [activeWorkout, setActiveWorkout] = useState(false)

  useEffect(() => {
    setActiveWorkout(!!localStorage.getItem('workoutStartTime'))
  }, [])

  useEffect(() => {
    if (!session) return
    Promise.all([
      fetch(`/api/workouts?email=${session.user.email}`).then(r => r.json()),
      fetch(`/api/sessions?email=${session.user.email}`).then(r => r.json()),
    ]).then(([workouts, sessions]) => {
      if (workouts.length > 0) setWorkout(workouts[workouts.length - 1])
      setTrainedDates(new Set(sessions.map(s => s.date)))
      setLoadingData(false)
    })
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

          <h1 className="font-heading font-black text-5xl uppercase leading-tight mb-2">
            MONTE O TREINO.
          </h1>
          <h1 className="font-heading font-black text-5xl uppercase leading-tight text-red-500 mb-4">
            LEVANTE PESADO.
          </h1>
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

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">

        {/* Hero */}
        <div className="relative bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-7 overflow-hidden">
          <div className="absolute top-0 right-0 w-56 h-56 bg-red-900/25 rounded-full blur-3xl pointer-events-none" />
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Bem-vindo de volta</p>
          <h1 className="font-heading font-black text-4xl uppercase leading-tight text-white">
            OLÁ, {firstName.toUpperCase()}.
          </h1>
          <p className="font-heading font-black text-4xl uppercase leading-tight text-red-500">
            BORA TREINAR?
          </p>
        </div>

        {/* Treino atual */}
        {loadingData ? (
          <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-6 h-40 animate-pulse" />
        ) : workout ? (
          <div className={`border rounded-2xl p-6 transition-colors ${activeWorkout ? 'bg-amber-950/20 border-amber-700' : 'bg-[#1a1a1a] border-zinc-800'}`}>
            <div className="flex justify-between items-start mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs text-zinc-600 uppercase tracking-widest">Treino atual</p>
                  {activeWorkout && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/20 border border-amber-600 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-[10px] text-amber-400 uppercase tracking-widest font-bold">Em andamento</span>
                    </span>
                  )}
                </div>
                <h2 className="font-heading font-black text-2xl uppercase text-white">{formatConfig?.name}</h2>
                <p className="text-zinc-500 text-xs mt-1">
                  {workout.days?.length} {workout.days?.length === 1 ? 'dia' : 'dias'} de treino
                </p>
              </div>
              <Link href="/my-workouts" className="text-xs text-zinc-500 hover:text-zinc-300 uppercase tracking-widest transition-colors">
                Ver todos →
              </Link>
            </div>

            {activeWorkout && (
              <div className="flex items-start gap-3 p-3 bg-amber-900/20 border border-amber-800 rounded-xl mb-4">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-amber-400">Você tem um treino em andamento. Encerre-o antes de iniciar um novo.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => router.push('/treino')}
                className={`flex-1 py-3 font-heading font-bold uppercase tracking-widest rounded-xl transition-colors flex items-center justify-center gap-2 ${
                  activeWorkout
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
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
            <p className="text-zinc-500 text-sm mb-5">Você ainda não tem um treino criado.</p>
            <Link
              href="/dashboard"
              className="inline-block px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-heading font-bold uppercase tracking-widest rounded-xl transition-colors"
            >
              Criar meu treino
            </Link>
          </div>
        )}

        {/* Calendário */}
        <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-6">
          <p className="text-xs text-zinc-600 uppercase tracking-widest mb-5">Histórico de treinos</p>
          {loadingData ? (
            <div className="h-52 animate-pulse bg-zinc-800/50 rounded-xl" />
          ) : (
            <Calendar trainedDates={trainedDates} />
          )}
        </div>

      </div>
    </div>
  )
}
