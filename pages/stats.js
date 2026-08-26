import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect, useState, useMemo } from 'react'
import { muscleGroupLabels } from '../lib/workoutConfig'
import { todayFortaleza, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addMonths } from '../lib/dates'
import { formatDuration } from '../lib/format'
import { apiFetch } from '../lib/api'
import { useToast } from '../components/ToastProvider'
import { calcStreak, calcBestStreak } from '../lib/workoutStats'

function fmtWeight(kg) {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`
  return `${Math.round(kg)}kg`
}

export default function Stats() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const toast = useToast()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('week')
  const [periodAnchor, setPeriodAnchor] = useState(() => todayFortaleza())
  const [selectedEx, setSelectedEx] = useState('')
  const [bodyWeights, setBodyWeights] = useState([])
  const [weightDate, setWeightDate] = useState(() => todayFortaleza())
  const [weightInput, setWeightInput] = useState('')
  const [savingWeight, setSavingWeight] = useState(false)

  useEffect(() => {
    if (!session) return
    fetch('/api/sessions')
      .then(r => r.json())
      .then(data => { setSessions(Array.isArray(data) ? data : []); setLoading(false) })
  }, [session])

  useEffect(() => {
    if (!session) return
    fetch('/api/body-weight')
      .then(r => r.json())
      .then(data => setBodyWeights(Array.isArray(data) ? data : []))
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
  const totalWeight    = doneSets.reduce((a, s) => a + (parseFloat(s.carga) || 0) * (parseInt(s.repeticoes) || 0), 0)
  const totalReps      = doneSets.reduce((a, s) => a + (parseInt(s.repeticoes) || 0), 0)
  const totalSetsCount = doneSets.length
  const streak         = calcStreak(sessions)
  const bestStreak     = calcBestStreak(sessions)

  // ── Período filtrado ──
  // Semana: segunda → domingo. Mês: dia 1 → último dia. A âncora (periodAnchor)
  // permite navegar para semanas/meses específicos do histórico.
  const todayStr = todayFortaleza()
  const periodStartStr = period === 'week' ? startOfWeek(periodAnchor) : startOfMonth(periodAnchor)
  const periodEndStr   = period === 'week' ? endOfWeek(periodAnchor)   : endOfMonth(periodAnchor)

  // Não é possível avançar para um período que ainda não começou.
  const isCurrentPeriod = todayStr >= periodStartStr && todayStr <= periodEndStr
  const canGoNext = periodEndStr < todayStr

  function shiftPeriod(dir) {
    setPeriodAnchor(a => (period === 'week' ? addDays(a, dir * 7) : addMonths(a, dir)))
  }

  const periodLabel = period === 'week'
    ? (() => {
        const [, sm, sd] = periodStartStr.split('-')
        const [, em, ed] = periodEndStr.split('-')
        return `${parseInt(sd, 10)}/${parseInt(sm, 10)} – ${parseInt(ed, 10)}/${parseInt(em, 10)}`
      })()
    : new Date(periodStartStr + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const pSessions  = sessions.filter(s => s.date >= periodStartStr && s.date <= periodEndStr)
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

  // Recordes batidos na última janela de 30 dias (a data do PR é a do dia em
  // que a carga máxima foi alcançada pela primeira vez).
  const pr30Start = addDays(todayStr, -29)
  const prs30 = prList.filter(p => p.date >= pr30Start).length

  // ── Volume semanal por músculo (semana atual: segunda → domingo) ──
  const weekStartStr = startOfWeek(todayStr)
  const weekEndStr   = endOfWeek(todayStr)
  const weekSessions = sessions.filter(s => s.date >= weekStartStr && s.date <= weekEndStr)
  const muscleWeekSets = {}
  weekSessions.forEach(s => {
    ;(s.exercisesData || []).forEach(e => {
      const mg = e.muscleGroup || 'outros'
      const done = (e.sets || []).filter(set => set.done).length
      if (done > 0) muscleWeekSets[mg] = (muscleWeekSets[mg] || 0) + done
    })
  })
  const muscleWeekList = Object.entries(muscleWeekSets).sort((a, b) => b[1] - a[1])

  // ── Grupos musculares (todo o histórico) ──
  // Conta séries concluídas, a mesma unidade do "Volume semanal". Antes contava
  // entradas de exercício, o que inflava grupos com muitos exercícios curtos.
  const muscleCount = {}
  sessions.forEach(s => {
    ;(s.exercisesData || []).forEach(e => {
      const done = (e.sets || []).filter(set => set.done).length
      if (done === 0) return
      const mg = e.muscleGroup || 'outros'
      muscleCount[mg] = (muscleCount[mg] || 0) + done
    })
  })
  const muscleList = Object.entries(muscleCount).sort((a, b) => b[1] - a[1])
  const maxMuscle  = muscleList[0]?.[1] || 1

  // ── Frequência: últimas 8 semanas (segunda → domingo) ──
  const thisWeekStart = startOfWeek(todayStr)
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const startStr = addDays(thisWeekStart, -i * 7)
    const endStr   = endOfWeek(startStr)
    const count    = sessions.filter(s => s.date >= startStr && s.date <= endStr).length
    const [, m, d]  = startStr.split('-')
    const label    = `${parseInt(d, 10)}/${parseInt(m, 10)}`
    return { label, count }
  }).reverse()
  const maxWeek = Math.max(...weeks.map(w => w.count), 1)

  const isEmpty = totalSessions === 0

  async function saveWeight() {
    if (!weightInput || !weightDate) return
    setSavingWeight(true)
    try {
      const entry = await apiFetch('/api/body-weight', {
        json: { date: weightDate, weight: parseFloat(weightInput) },
      })
      setBodyWeights(prev => {
        const filtered = prev.filter(e => e.date !== entry.date)
        return [...filtered, entry].sort((a, b) => a.date.localeCompare(b.date))
      })
      setWeightInput('')
      toast(`Peso de ${entry.weight}kg registrado`)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSavingWeight(false)
    }
  }

  async function deleteWeight(id) {
    try {
      await apiFetch(`/api/body-weight?id=${id}`, { method: 'DELETE' })
      setBodyWeights(prev => prev.filter(e => e.id !== id))
      toast('Registro removido')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

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
              <KpiCard label="Peso levantado" value={fmtWeight(totalWeight)} sub={`${totalReps.toLocaleString('pt-BR')} reps`} />
              <KpiCard label="Séries feitas" value={totalSetsCount.toLocaleString('pt-BR')} sub={`${(totalSetsCount / totalSessions).toFixed(1)} por treino`} />
              <KpiCard label="Recordes" value={prs30} sub="PRs nos últimos 30 dias" />
              <KpiCard
                label="Melhor sequência"
                value={bestStreak === 0 ? '—' : `${bestStreak} dias`}
                sub={bestStreak > 0 && streak === bestStreak ? 'você está no recorde 🔥' : 'recorde de dias seguidos'}
              />
            </div>

            {/* Período */}
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading font-black text-lg uppercase text-white">Período</h2>
                <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
                  {['week', 'month'].map(p => (
                    <button key={p} onClick={() => { setPeriod(p); setPeriodAnchor(todayFortaleza()) }}
                      className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-colors ${period === p ? 'bg-red-600 text-white' : 'text-zinc-300 hover:text-white'}`}
                    >
                      {p === 'week' ? 'Semana' : 'Mês'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Navegação de período */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => shiftPeriod(-1)}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
                  aria-label={period === 'week' ? 'Semana anterior' : 'Mês anterior'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-heading font-bold uppercase tracking-widest text-white text-sm text-center capitalize">{periodLabel}</span>
                  {isCurrentPeriod && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-600 text-white rounded uppercase tracking-widest flex-shrink-0">Atual</span>
                  )}
                </div>
                <button
                  onClick={() => shiftPeriod(1)}
                  disabled={!canGoNext}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-300"
                  aria-label={period === 'week' ? 'Próxima semana' : 'Próximo mês'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {pSessions.length === 0 && (
                <p className="text-zinc-500 text-xs text-center py-2 mb-2">Nenhum treino neste período.</p>
              )}
              <div className="grid grid-cols-3 gap-2">
                <PeriodCard label="Treinos"     value={pSessions.length} />
                <PeriodCard label="Exercícios"  value={pExercises} />
                <PeriodCard label="Séries"      value={pSets.length} />
                <PeriodCard label="Repetições"  value={pReps.toLocaleString('pt-BR')} />
                <PeriodCard label="Peso"        value={fmtWeight(pWeight)} />
                <PeriodCard label="Tempo"       value={formatDuration(pDuration, 'short')} />
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
                <p className="text-xs text-zinc-400 mb-4">Séries por músculo nesta semana (seg–dom) · recomendado: 10–20/semana</p>
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
                <h2 className="font-heading font-black text-lg uppercase text-white mb-1">Grupos mais treinados</h2>
                <p className="text-xs text-zinc-400 mb-4">Séries concluídas em todo o histórico</p>
                <div className="space-y-3">
                  {muscleList.slice(0, 8).map(([mg, count]) => (
                    <div key={mg}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-zinc-200">{muscleGroupLabels[mg] || mg}</span>
                        <span className="text-xs text-zinc-400">{count} séries</span>
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

            {/* Peso corporal */}
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
              <h2 className="font-heading font-black text-lg uppercase text-white mb-1">Peso corporal</h2>
              <p className="text-xs text-zinc-400 mb-4">Registre seu peso e acompanhe a evolução</p>

              {/* Formulário de registro */}
              <div className="flex gap-2 mb-5">
                <input
                  type="date"
                  value={weightDate}
                  onChange={e => setWeightDate(e.target.value)}
                  className="flex-1 min-w-0"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="1"
                  placeholder="kg"
                  value={weightInput}
                  onChange={e => setWeightInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveWeight()}
                  className="w-20 flex-shrink-0"
                />
                <button
                  onClick={saveWeight}
                  disabled={!weightInput || savingWeight}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-heading font-bold text-xs uppercase tracking-widest rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {savingWeight ? '...' : 'Salvar'}
                </button>
              </div>

              {bodyWeights.length < 2 ? (
                <p className="text-zinc-500 text-xs text-center py-4">
                  {bodyWeights.length === 0
                    ? 'Registre seu primeiro peso para ver a progressão.'
                    : 'Adicione mais um registro para ver o gráfico.'}
                </p>
              ) : (
                <>
                  <WeightChart data={bodyWeights} />

                  {(() => {
                    const first = bodyWeights[0]
                    const last = bodyWeights[bodyWeights.length - 1]
                    const diff = last.weight - first.weight
                    const days = Math.round((new Date(last.date) - new Date(first.date)) / (86400000))
                    if (diff === 0) return null
                    return (
                      <p className="text-xs mt-3 mb-3 pt-3 border-t border-zinc-800 text-zinc-400">
                        <span className="text-zinc-100 font-semibold">
                          {diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}kg
                        </span>
                        {' '}em {days} dias
                      </p>
                    )
                  })()}

                  <div className="space-y-0.5 mt-2">
                    {[...bodyWeights].reverse().slice(0, 10).map((entry, i, arr) => {
                      const prevEntry = arr[i + 1]
                      const diff = prevEntry != null ? entry.weight - prevEntry.weight : null
                      return (
                        <div key={entry.id} className="flex items-center justify-between py-2 border-b border-zinc-800/60 last:border-0">
                          <span className="text-xs text-zinc-400">
                            {new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          <div className="flex items-center gap-3">
                            {diff !== null && diff !== 0 && (
                              <span className="text-[10px] font-bold text-zinc-500">
                                {diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}kg
                              </span>
                            )}
                            <span className="font-heading font-black text-white text-base">{entry.weight.toFixed(1)}kg</span>
                            <button
                              onClick={() => deleteWeight(entry.id)}
                              className="text-zinc-700 hover:text-zinc-400 transition-colors"
                              aria-label="Remover registro"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

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

function WeightChart({ data }) {
  const W = 320, H = 100, PAD = 16
  const weights = data.map(d => d.weight)
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  const range = maxW - minW || 0.5

  const points = data.map((d, i) => {
    const x = PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2)
    const y = H - PAD - ((d.weight - minW) / range) * (H - PAD * 2)
    return { x, y, ...d }
  })

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ')
  const area = `M${points[0].x},${H - PAD} ` +
    points.map(p => `L${p.x},${p.y}`).join(' ') +
    ` L${points[points.length - 1].x},${H - PAD} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }}>
      <defs>
        <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dc2626" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#weightGrad)" />
      <polyline points={polyline} fill="none" stroke="#dc2626" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#dc2626" />
      ))}
      <text x={PAD} y={H - 2} textAnchor="start" fontSize="8" fill="#52525b">
        {new Date(points[0].date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
      </text>
      <text x={W - PAD} y={H - 2} textAnchor="end" fontSize="8" fill="#52525b">
        {new Date(points[points.length - 1].date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
      </text>
      <text x={W - PAD} y={points[points.length - 1].y - 6} textAnchor="end" fontSize="9" fill="#f4f4f5" fontWeight="bold">
        {points[points.length - 1].weight.toFixed(1)}kg
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
