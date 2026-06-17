import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { muscleGroupLabels } from '../lib/workoutConfig'

function fmtDuration(s) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}min`
}

function fmtWeight(kg) {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`
  return `${Math.round(kg)}kg`
}

function calcStreak(sessions) {
  const dateSet = new Set(sessions.map(s => s.date))
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  const start = dateSet.has(today) ? today : dateSet.has(yesterdayStr) ? yesterdayStr : null
  if (!start) return 0

  let streak = 0
  const cur = new Date(start + 'T12:00:00')
  while (true) {
    const d = cur.toISOString().split('T')[0]
    if (!dateSet.has(d)) break
    streak++
    cur.setDate(cur.getDate() - 1)
  }
  return streak
}

export default function Stats() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('week')

  useEffect(() => {
    if (!session) return
    fetch(`/api/sessions?email=${session.user.email}`)
      .then(r => r.json())
      .then(data => { setSessions(Array.isArray(data) ? data : []); setLoading(false) })
  }, [session])

  if (status === 'loading' || loading) return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!session) { router.push('/'); return null }

  // ── Métricas gerais ──
  const allExerciseSets = sessions.flatMap(s =>
    (s.exercisesData || []).flatMap(e =>
      (e.sets || []).map(set => ({ ...set, name: e.name, muscleGroup: e.muscleGroup }))
    )
  )
  const doneSets = allExerciseSets.filter(s => s.done)

  const totalSessions  = sessions.length
  const totalDuration  = sessions.reduce((a, s) => a + (s.duration || 0), 0)
  const totalWeight    = doneSets.reduce((a, s) => a + (parseFloat(s.carga) || 0) * (parseInt(s.repeticoes) || 0), 0)
  const totalReps      = doneSets.reduce((a, s) => a + (parseInt(s.repeticoes) || 0), 0)
  const totalSetsCount = doneSets.length
  const streak         = calcStreak(sessions)
  const avgDuration    = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0
  const longestSession = sessions.reduce((max, s) => Math.max(max, s.duration || 0), 0)

  // ── Período filtrado ──
  const now = new Date()
  const periodStart = new Date(now)
  if (period === 'week') periodStart.setDate(now.getDate() - 7)
  else periodStart.setMonth(now.getMonth() - 1)
  const periodStartStr = periodStart.toISOString().split('T')[0]

  const pSessions  = sessions.filter(s => s.date >= periodStartStr)
  const pSets      = pSessions.flatMap(s => (s.exercisesData || []).flatMap(e => (e.sets || []).filter(set => set.done)))
  const pWeight    = pSets.reduce((a, s) => a + (parseFloat(s.carga) || 0) * (parseInt(s.repeticoes) || 0), 0)
  const pReps      = pSets.reduce((a, s) => a + (parseInt(s.repeticoes) || 0), 0)
  const pExercises = pSessions.flatMap(s => s.exercisesData || []).length
  const pDuration  = pSessions.reduce((a, s) => a + (s.duration || 0), 0)

  // ── PRs ──
  const prs = {}
  sessions.forEach(s => {
    ;(s.exercisesData || []).forEach(e => {
      ;(e.sets || []).filter(set => set.done && set.carga).forEach(set => {
        const w = parseFloat(set.carga)
        if (!prs[e.name] || w > prs[e.name]) prs[e.name] = w
      })
    })
  })
  const prList = Object.entries(prs).sort((a, b) => b[1] - a[1])

  // ── Grupos musculares ──
  const muscleCount = {}
  sessions.forEach(s => {
    ;(s.exercisesData || []).forEach(e => {
      const mg = e.muscleGroup || 'outros'
      muscleCount[mg] = (muscleCount[mg] || 0) + 1
    })
  })
  const muscleList = Object.entries(muscleCount).sort((a, b) => b[1] - a[1])
  const maxMuscle  = muscleList[0]?.[1] || 1

  // ── Frequência: últimas 8 semanas ──
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const wEnd = new Date(now)
    wEnd.setDate(now.getDate() - i * 7)
    const wStart = new Date(wEnd)
    wStart.setDate(wEnd.getDate() - 6)
    const startStr = wStart.toISOString().split('T')[0]
    const endStr   = wEnd.toISOString().split('T')[0]
    const count    = sessions.filter(s => s.date >= startStr && s.date <= endStr).length
    const label    = `${wStart.getDate()}/${wStart.getMonth() + 1}`
    return { label, count }
  }).reverse()
  const maxWeek = Math.max(...weeks.map(w => w.count), 1)

  const isEmpty = totalSessions === 0

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        <div>
          <p className="text-xs text-zinc-600 uppercase tracking-widest mb-1">Desempenho</p>
          <h1 className="font-heading font-black text-4xl uppercase text-white">Estatísticas</h1>
        </div>

        {isEmpty ? (
          <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-10 text-center">
            <p className="text-zinc-500 text-sm mb-1">Nenhum treino registrado ainda.</p>
            <p className="text-zinc-600 text-xs">Conclua seu primeiro treino para ver as estatísticas.</p>
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Treinos" value={totalSessions} sub="sessões concluídas" accent />
              <KpiCard label="Sequência" value={streak === 0 ? '—' : `${streak} 🔥`} sub={streak > 0 ? 'dias seguidos' : 'sem sequência ativa'} />
              <KpiCard label="Tempo total" value={fmtDuration(totalDuration)} sub={`Média: ${fmtDuration(avgDuration)}/treino`} />
              <KpiCard label="Peso levantado" value={fmtWeight(totalWeight)} sub={`${totalReps.toLocaleString('pt-BR')} reps`} />
              <KpiCard label="Séries feitas" value={totalSetsCount.toLocaleString('pt-BR')} />
              <KpiCard label="Treino mais longo" value={fmtDuration(longestSession)} />
            </div>

            {/* Período */}
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading font-black text-lg uppercase text-white">Período</h2>
                <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
                  {['week', 'month'].map(p => (
                    <button key={p} onClick={() => setPeriod(p)}
                      className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-colors ${period === p ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      {p === 'week' ? 'Semana' : 'Mês'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <PeriodCard label="Treinos"     value={pSessions.length} />
                <PeriodCard label="Exercícios"  value={pExercises} />
                <PeriodCard label="Séries"      value={pSets.length} />
                <PeriodCard label="Repetições"  value={pReps.toLocaleString('pt-BR')} />
                <PeriodCard label="Peso"        value={fmtWeight(pWeight)} />
                <PeriodCard label="Tempo"       value={fmtDuration(pDuration)} />
              </div>
            </div>

            {/* Frequência semanal */}
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
              <h2 className="font-heading font-black text-lg uppercase text-white mb-1">Frequência semanal</h2>
              <p className="text-xs text-zinc-600 mb-4">Últimas 8 semanas</p>
              <div className="flex items-end gap-1.5 h-24">
                {weeks.map((w, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-zinc-500 h-3">{w.count > 0 ? w.count : ''}</span>
                    <div className="w-full rounded-sm transition-all duration-500"
                      style={{
                        height: `${Math.max((w.count / maxWeek) * 64, w.count > 0 ? 6 : 0)}px`,
                        background: w.count >= 4 ? '#16a34a' : w.count >= 2 ? '#dc2626' : w.count > 0 ? '#991b1b' : '#27272a',
                      }}
                    />
                    <span className="text-[8px] text-zinc-700 text-center leading-tight">{w.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-3">
                <LegendDot color="bg-green-600" label="4+ treinos" />
                <LegendDot color="bg-red-600"   label="2–3" />
                <LegendDot color="bg-red-900"   label="1" />
              </div>
            </div>

            {/* Grupos musculares */}
            {muscleList.length > 0 && (
              <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
                <h2 className="font-heading font-black text-lg uppercase text-white mb-4">Grupos mais treinados</h2>
                <div className="space-y-3">
                  {muscleList.slice(0, 8).map(([mg, count]) => (
                    <div key={mg}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-zinc-300">{muscleGroupLabels[mg] || mg}</span>
                        <span className="text-xs text-zinc-500">{count}×</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-1.5 bg-red-600 rounded-full transition-all duration-700"
                          style={{ width: `${(count / maxMuscle) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PRs */}
            {prList.length > 0 && (
              <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
                <h2 className="font-heading font-black text-lg uppercase text-white mb-1">Recordes pessoais</h2>
                <p className="text-xs text-zinc-600 mb-4">Maior carga registrada por exercício</p>
                <div className="space-y-0.5">
                  {prList.map(([name, weight], i) => (
                    <div key={name} className="flex items-center justify-between py-3 border-b border-zinc-800/60 last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-5 text-right text-xs font-mono flex-shrink-0 ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-zinc-400' : i === 2 ? 'text-amber-700' : 'text-zinc-700'}`}>
                          {i + 1}
                        </span>
                        <span className="text-sm text-zinc-300 truncate">{name}</span>
                      </div>
                      <span className="font-heading font-black text-xl text-red-400 flex-shrink-0 ml-3">{weight}kg</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, accent }) {
  return (
    <div className={`bg-[#1a1a1a] border rounded-2xl p-4 ${accent ? 'border-red-900/50' : 'border-zinc-800'}`}>
      <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{label}</p>
      <p className={`font-heading font-black text-3xl leading-none ${accent ? 'text-red-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-[11px] text-zinc-600 mt-1.5">{sub}</p>}
    </div>
  )
}

function PeriodCard({ label, value }) {
  return (
    <div className="bg-zinc-900/60 rounded-xl p-3">
      <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{label}</p>
      <p className="font-heading font-black text-xl text-white leading-none">{value}</p>
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
      <span className="text-[10px] text-zinc-600">{label}</span>
    </div>
  )
}
