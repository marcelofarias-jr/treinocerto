import { getFormatConfig, muscleGroupLabels } from '../lib/workoutConfig'
import SortableList from './SortableList'
import PositionInput from './PositionInput'

/* Ícone de alça de arraste */
function GripIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <circle cx="7" cy="5" r="1.4" /><circle cx="13" cy="5" r="1.4" />
      <circle cx="7" cy="10" r="1.4" /><circle cx="13" cy="10" r="1.4" />
      <circle cx="7" cy="15" r="1.4" /><circle cx="13" cy="15" r="1.4" />
    </svg>
  )
}

function move(arr, from, to) {
  const next = [...arr]
  if (to < 0 || to >= next.length) return arr
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/*
 * PASSO 3 — Ordena os exercícios do dia numa sequência única, com liberdade
 * total (músculos podem ser intercalados). Arraste pela alça, use as setas ou
 * digite o número da posição. Define séries, reps, carga, descanso e obs.
 */
export default function WorkoutArranger({
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

  function updateField(dayId, index, field, value) {
    const current = sequenceByDay[dayId] || []
    const next = current.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    onSequenceChange({ ...sequenceByDay, [dayId]: next })
  }

  const hasAnything = config.days.some(d => (sequenceByDay[d.id] || []).length > 0)

  if (!hasAnything) {
    return (
      <p className="text-zinc-500 text-sm py-4">
        Nenhum exercício selecionado ainda. Volte ao passo anterior para escolher grupos e exercícios.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {config.days.map(day => {
        const list = sequenceByDay[day.id] || []
        if (list.length === 0) return null

        return (
          <div key={day.id} className="border border-zinc-800 rounded-xl overflow-hidden">
            {/* Cabeçalho do dia */}
            <div className="px-4 py-3 border-b border-zinc-800 bg-[#232323] flex items-center gap-2">
              <span className="w-5 h-5 bg-red-600 rounded flex items-center justify-center text-[10px] font-black text-white flex-shrink-0">
                {day.id}
              </span>
              <p className="font-heading font-bold text-white uppercase tracking-wide text-sm">
                {day.name} · <span className="text-zinc-400">{day.label}</span>
              </p>
            </div>

            <div className="p-4">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">
                Arraste pela alça ⠿, use as setas ou digite o número para ordenar
              </p>

              <SortableList
                items={list}
                getKey={item => `${item.muscleGroup}|${item.name}`}
                onReorder={(from, to) => reorder(day.id, from, to)}
                className="space-y-2"
                renderItem={(item, { index: idx, isDragging, handleProps, setItemRef }) => (
                  <div
                    ref={setItemRef}
                    className={`rounded-lg border p-2.5 transition-all ${
                      isDragging ? 'border-red-500 ring-1 ring-red-500 shadow-lg bg-[#232323]' : 'border-zinc-800 bg-[#232323]/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        {...handleProps}
                        className="text-zinc-500 hover:text-zinc-200 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none p-1 -m-1"
                        title="Arraste para reordenar"
                      >
                        <GripIcon className="w-4 h-4" />
                      </span>
                      <PositionInput
                        value={idx + 1}
                        max={list.length}
                        onCommit={n => setPosition(day.id, idx, n)}
                        title="Posição na sequência"
                        className="!px-0 !py-0.5 w-8 text-center text-[11px] font-mono font-bold text-zinc-300 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest block leading-none">
                          {muscleGroupLabels[item.muscleGroup] || item.muscleGroup}
                        </span>
                        <p className="text-xs text-zinc-100 font-semibold truncate">{item.name}</p>
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-6">
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Séries</p>
                        <input type="number" min="1" max="10" placeholder="3" value={item.series ?? '3'}
                          onChange={e => updateField(day.id, idx, 'series', e.target.value)} className="w-full" />
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Reps alvo</p>
                        <input type="text" placeholder="8-12" value={item.repeticoes}
                          onChange={e => updateField(day.id, idx, 'repeticoes', e.target.value)} className="w-full" />
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Carga (kg)</p>
                        <input type="number" placeholder="0" value={item.carga}
                          onChange={e => updateField(day.id, idx, 'carga', e.target.value)} className="w-full" />
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Descanso (s)</p>
                        <input type="number" min="0" placeholder="60" value={item.descanso ?? '60'}
                          onChange={e => updateField(day.id, idx, 'descanso', e.target.value)} className="w-full" />
                      </div>
                    </div>
                    <input type="text" placeholder="Observações (ex: halteres, pegada pronada...)"
                      value={item.observacoes}
                      onChange={e => updateField(day.id, idx, 'observacoes', e.target.value)}
                      className="w-full !px-2 !py-1.5 text-sm mt-2 ml-0 md:ml-6 md:w-[calc(100%-1.5rem)]" />
                  </div>
                )}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
