import { getFormatConfig, muscleGroupLabels } from '../lib/workoutConfig'
import PositionInput from './PositionInput'

function move(arr, from, to) {
  const next = [...arr]
  if (to < 0 || to >= next.length) return arr
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/*
 * PASSO 4 — Revisão final. Mostra a sequência completa de cada dia, numerada
 * na ordem de execução (músculos podem estar intercalados), e permite ajustes
 * finais digitando o número da posição ou usando as setas, antes de salvar.
 */
export default function WorkoutReview({
  format,
  variant,
  sequenceByDay,
  onSequenceChange,
}) {
  const config = getFormatConfig(format, variant)
  if (!config) return null

  function reorder(dayId, from, to) {
    const current = sequenceByDay[dayId] || []
    onSequenceChange({ ...sequenceByDay, [dayId]: move(current, from, to) })
  }

  function setPosition(dayId, from, n) {
    const len = (sequenceByDay[dayId] || []).length
    const to = Math.min(Math.max(n, 1), len) - 1
    if (to !== from) reorder(dayId, from, to)
  }

  const daysWithContent = config.days
    .map(day => ({ day, list: sequenceByDay[day.id] || [] }))
    .filter(d => d.list.length > 0)

  if (daysWithContent.length === 0) {
    return (
      <p className="text-zinc-500 text-sm py-4">
        Nenhum exercício selecionado ainda. Volte aos passos anteriores para montar o treino.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-zinc-500 leading-relaxed">
        Confira a ordem de execução. Ajuste digitando o número da posição no exercício
        ou usando as setas. Quando estiver tudo certo, salve o treino.
      </p>

      {daysWithContent.map(({ day, list }) => (
        <div key={day.id} className="border border-zinc-800 rounded-xl overflow-hidden">
          {/* Cabeçalho do dia */}
          <div className="px-4 py-3 border-b border-zinc-800 bg-[#232323] flex items-center gap-2">
            <span className="w-5 h-5 bg-red-600 rounded flex items-center justify-center text-[10px] font-black text-white flex-shrink-0">
              {day.id}
            </span>
            <p className="font-heading font-bold text-white uppercase tracking-wide text-sm">
              {day.name} · <span className="text-zinc-400">{day.label}</span>
            </p>
            <span className="ml-auto text-[10px] text-zinc-500 uppercase tracking-widest flex-shrink-0">
              {list.length} {list.length === 1 ? 'exercício' : 'exercícios'}
            </span>
          </div>

          <div className="p-3 space-y-1.5">
            {list.map((item, idx) => {
              const summary = [
                `${item.series ?? '3'}× ${item.repeticoes || '—'}`,
                item.carga ? `${item.carga}kg` : null,
                item.descanso ? `${item.descanso}s desc.` : null,
              ].filter(Boolean).join(' · ')

              return (
                <div key={`${item.muscleGroup}|${item.name}`} className="flex items-center gap-2.5 rounded-lg border border-zinc-800 bg-[#232323]/40 px-2.5 py-2">
                  <PositionInput
                    value={idx + 1}
                    max={list.length}
                    onCommit={n => setPosition(day.id, idx, n)}
                    title="Posição na sequência"
                    className="!px-0 !py-1 w-9 text-center text-sm font-mono font-black text-red-500 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block leading-none mb-0.5">
                      {muscleGroupLabels[item.muscleGroup] || item.muscleGroup}
                    </span>
                    <p className="text-xs text-zinc-100 font-semibold truncate">{item.name}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{summary}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => reorder(day.id, idx, idx - 1)} disabled={idx === 0}
                      className="w-7 h-7 flex items-center justify-center rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Mover para cima">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button onClick={() => reorder(day.id, idx, idx + 1)} disabled={idx === list.length - 1}
                      className="w-7 h-7 flex items-center justify-center rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Mover para baixo">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
