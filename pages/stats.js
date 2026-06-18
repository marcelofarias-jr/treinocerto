import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect, useState, useMemo } from 'react'
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
  const [selectedEx, setSelectedEx] = useState('')

  useEffect(() => {
    if (!session) return
    fetch(`/api/sessions?email=${session.user.email}`)
      .then(r => r.json())
      .then(data => { setSessions(Array.isArray(data) ? data : []); setLoading(false) })
  }, [session])

  // Hooks devem vir antes de qualquer early return
  const allExerciseNames = useMemo(() => {
    const names = new Set(sessions.flatMap(s => (s.exercisesData || []).map(e => e.name)))
    return [...names].sort()
  }, [sessions])

  const currentEx = selectedEx || allExerciseNames[0] || ''

  const progression = useMemo(() => {
    if (!currentEx) return []
    return sessions
      .filter(s => (s.exercisesData || []).some(e => e.name === currentEx))
      .map(s => {
        const ex = s.exercisesData.find(e => e.name === currentEx)
        const doneSets = (ex?.sets || []).filter(set => set.done && set.carga)
        const maxW = doneSets.length ? Math.max(...doneSets.map(set => parseFloat(set.carga) || 0)) : 0
        const totalVol = doneSets.reduce((a, set) => a + (parseFloat(set.carga) || 0) * (parseInt(set.repeticoes) || 0), 0)
        return { date: s.date, maxW, totalVol }
      })
      .filter(p => p.maxW > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [sessions, currentEx])

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

  // ── PRs (com data) ──
  const prs = {}
  sessions.forEach(s => {
    ;(s.exercisesData || []).forEach(e => {
      ;(e.sets || []).filter(set => set.done && set.carga).forEach(set => {
        const w = parseFloat(set.carga)
        if (!prs[e.name] || w > prs[e.name].weight) {
          prs[e.name] = { weight: w, date: s.date }
        }
      })
    })
  })
  const prList = Object.entries(prs)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.weight - a.weight)

  // ── Volume semanal por músculo ──
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 6)
  const weekStartStr = weekStart.toISOString().split('T')[0]
  const weekSessions = sessions.filter(s => s.date >= weekStartStr)
  const muscleWeekSets = {}
  weekSessions.forEach(s => {
    ;(s.exercisesData || []).forEach(e => {
      const mg = e.muscleGroup || 'outros'
      const done = (e.sets || []).filter(set => set.done).length
      if (done > 0) muscleWeekSets[mg] = (muscleWeekSets[mg] || 0) + done
    })
  })
  const muscleWeekList = Object.entries(muscleWeekSets).sort((a, b) => b[1] - a[1])

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
          <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Desempenho</p>
          <h1 className="font-heading font-black text-4xl uppercase text-white">Estatísticas</h1>
        </div>

        {isEmpty ? (
          <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-10 text-center">
            <p className="text-zinc-300 text-sm mb-1">Nenhum treino registrado ainda.</p>
            <p className="text-zinc-400 text-xs">Conclua seu primeiro treino para ver as estatísticas.</p>
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
                      className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-colors ${period === p ? 'bg-red-600 text-white' : 'text-zinc-300 hover:text-white'}`}
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
              <p className="text-xs text-zinc-400 mb-4">Últimas 8 semanas</p>
              <div className="flex items-end gap-1.5 h-24">
                {weeks.map((w, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-zinc-400 h-3">{w.count > 0 ? w.count : ''}</span>
                    <div className="w-full rounded-sm transition-all duration-500"
                      style={{
                        height: `${Math.max((w.count / maxWeek) * 64, w.count > 0 ? 6 : 0)}px`,
                        background: w.count >= 4 ? '#16a34a' : w.count >= 2 ? '#dc2626' : w.count > 0 ? '#991b1b' : '#27272a',
                      }}
                    />
                    <span className="text-[8px] text-zinc-400 text-center leading-tight">{w.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-3">
                <LegendDot color="bg-green-600" label="4+ treinos" />
                <LegendDot color="bg-red-600"   label="2–3" />
                <LegendDot color="bg-red-900"   label="1" />
              </div>
            </div>

            {/* Volume semanal por músculo */}
            {muscleWeekList.length > 0 && (
              <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
                <h2 className="font-heading font-black text-lg uppercase text-white mb-1">Volume semanal</h2>
                <p className="text-xs text-zinc-400 mb-4">Séries por músculo nos últimos 7 dias · recomendado: 10–20/semana</p>
                <div className="space-y-3">
                  {muscleWeekList.map(([mg, count]) => {
                    const pct = Math.min(100, Math.round((count / 20) * 100))
                    const color = count >= 10 ? 'bg-green-600' : count >= 5 ? 'bg-yellow-600' : 'bg-red-700'
                    const label = count >= 20 ? 'Ótimo' : count >= 10 ? 'Bom' : count >= 5 ? 'Pouco' : 'Baixo'
                    const labelColor = count >= 10 ? 'text-green-500' : count >= 5 ? 'text-yellow-500' : 'text-red-500'
                    return (
                      <div key={mg}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm text-zinc-200">{muscleGroupLabels[mg] || mg}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wide ${labelColor}`}>{label}</span>
                            <span className="text-xs text-zinc-400 font-heading font-bold">{count} séries</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div className={`h-1.5 ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="text-[10px] text-zinc-600 mt-3">Baseado nas séries concluídas desta semana.</p>
              </div>
            )}

            {/* Grupos musculares */}
            {muscleList.length > 0 && (
              <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
                <h2 className="font-heading font-black text-lg uppercase text-white mb-4">Grupos mais treinados</h2>
                <div className="space-y-3">
                  {muscleList.slice(0, 8).map(([mg, count]) => (
                    <div key={mg}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-zinc-200">{muscleGroupLabels[mg] || mg}</span>
                        <span className="text-xs text-zinc-400">{count}×</span>
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

            {/* Progressão por exercício */}
            {allExerciseNames.length > 0 && (
              <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
                <h2 className="font-heading font-black text-lg uppercase text-white mb-1">Ganho de força</h2>
                <p className="text-xs text-zinc-400 mb-4">Carga máxima por sessão ao longo do tempo</p>

                {/* Seletor de exercício */}
                <select
                  value={currentEx}
                  onChange={e => setSelectedEx(e.target.value)}
                  className="w-full mb-5"
                >
                  {allExerciseNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>

                {progression.length < 2 ? (
                  <p className="text-zinc-500 text-xs text-center py-4">
                    {progression.length === 0
                      ? 'Nenhuma sessão registrada para este exercício.'
                      : 'Faça pelo menos 2 sessões para ver a progressão.'}
                  </p>
                ) : (
                  <>
                    {/* Gráfico SVG */}
                    <ProgressionChart data={progression} />

                    {/* Tabela de histórico */}
                    <div className="mt-4 space-y-0.5">
                      {[...progression].reverse().slice(0, 8).map((p, i) => {
                        const prev = progression[progression.length - 2 - i]
                        const diff = prev ? p.maxW - prev.maxW : null
                        return (
                          <div key={p.date} className="flex items-center justify-between py-2 border-b border-zinc-800/60 last:border-0">
                            <span className="text-xs text-zinc-400">
                              {new Date(p.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </span>
                            <div className="flex items-center gap-3">
                              {diff !== null && diff !== 0 && (
                                <span className={`text-[10px] font-bold ${diff > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                  {diff > 0 ? `+${diff}` : diff}kg
                                </span>
                              )}
                              <span className="font-heading font-black text-white text-base">{p.maxW}kg</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Resumo */}
                    {(() => {
                      const first = progression[0].maxW
                      const last = progression[progression.length - 1].maxW
                      const gain = last - first
                      return gain !== 0 ? (
                        <p className={`text-xs mt-3 pt-3 border-t border-zinc-800 ${gain > 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {gain > 0 ? '↑' : '↓'} {Math.abs(gain)}kg desde a primeira sessão registrada
                        </p>
                      ) : null
                    })()}
                  </>
                )}
              </div>
            )}

            {/* PRs */}
            {prList.length > 0 && (
              <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
                <h2 className="font-heading font-black text-lg uppercase text-white mb-1">Recordes pessoais</h2>
                <p className="text-xs text-zinc-400 mb-4">Maior carga registrada por exercício</p>
                <div className="space-y-0.5">
                  {prList.map(({ name, weight, date }, i) => (
                    <div key={name} className="flex items-center justify-between py-3 border-b border-zinc-800/60 last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-5 text-right text-xs font-mono flex-shrink-0 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-amber-600' : 'text-zinc-500'}`}>
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm text-zinc-200 truncate">{name}</p>
                          {date && (
                            <p className="text-[10px] text-zinc-600">
                              {new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                          )}
                        </div>
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

function ProgressionChart({ data }) {
  const W = 320, H = 100, PAD = 16
  const minW = Math.min(...data.map(d => d.maxW))
  const maxW = Math.max(...data.map(d => d.maxW))
  const range = maxW - minW || 1

  const points = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((d.maxW - minW) / range) * (H - PAD * 2)
    return { x, y, ...d }
  })

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ')
  const area = `M${points[0].x},${H - PAD} ` +
    points.map(p => `L${p.x},${p.y}`).join(' ') +
    ` L${points[points.length - 1].x},${H - PAD} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dc2626" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#chartGrad)" />
      <polyline points={polyline} fill="none" stroke="#dc2626" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#dc2626" />
      ))}
      {/* Labels dos extremos */}
      <text x={points[0].x} y={H - 2} textAnchor="middle" fontSize="8" fill="#52525b">
        {new Date(points[0].date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
      </text>
      <text x={points[points.length - 1].x} y={H - 2} textAnchor="middle" fontSize="8" fill="#52525b">
        {new Date(points[points.length - 1].date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
      </text>
      <text x={W - PAD} y={points[points.length - 1].y - 5} textAnchor="end" fontSize="9" fill="#f4f4f5" fontWeight="bold">
        {maxW}kg
      </text>
    </svg>
  )
}

function KpiCard({ label, value, sub, accent }) {
  return (
    <div className={`bg-[#1a1a1a] border rounded-2xl p-4 ${accent ? 'border-red-900/50' : 'border-zinc-800'}`}>
      <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">{label}</p>
      <p className={`font-heading font-black text-3xl leading-none ${accent ? 'text-red-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-[11px] text-zinc-400 mt-1.5">{sub}</p>}
    </div>
  )
}

function PeriodCard({ label, value }) {
  return (
    <div className="bg-zinc-900/60 rounded-xl p-3">
      <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="font-heading font-black text-xl text-white leading-none">{value}</p>
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
      <span className="text-[10px] text-zinc-400">{label}</span>
    </div>
  )
}
