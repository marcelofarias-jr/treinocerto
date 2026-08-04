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
 * PASSO 3 — Ordena grupos e exercícios (arraste em touch e desktop, com setas
 * de apoio) e define séries, reps, carga, descanso e observações.
 */
export default function WorkoutArranger({
  format,
  variant,
  selectedMusclesByDay,
  selectedExercisesByDay,
  onMusclesChange,
  onExercisesChange,
}) {
  const config = getFormatConfig(format, variant)
  if (!config) return null

  function reorderGroups(dayId, from, to) {
    const current = selectedMusclesByDay[dayId] || []
    onMusclesChange({ ...selectedMusclesByDay, [dayId]: move(current, from, to) })
  }

  function reorderExercise(key, from, to) {
    const current = selectedExercisesByDay[key] || []
    onExercisesChange({ ...selectedExercisesByDay, [key]: move(current, from, to) })
  }

  // Move o exercício para a posição digitada (1-indexada dentro do grupo).
  function setExercisePosition(key, from, n) {
    const len = (selectedExercisesByDay[key] || []).length
    const to = Math.min(Math.max(n, 1), len) - 1
    if (to !== from) reorderExercise(key, from, to)
  }

  function updateField(key, exercise, field, value) {
    const current = selectedExercisesByDay[key] || []
    const next = current.map(e => e.name === exercise ? { ...e, [field]: value } : e)
    onExercisesChange({ ...selectedExercisesByDay, [key]: next })
  }

  const hasAnything = config.days.some(d => {
    const groups = selectedMusclesByDay[d.id] || []
    return groups.some(mg => (selectedExercisesByDay[`${d.id}_${mg}`] || []).length > 0)
  })

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
        const groups = (selectedMusclesByDay[day.id] || []).filter(
          mg => (selectedExercisesByDay[`${day.id}_${mg}`] || []).length > 0
        )
        if (groups.length === 0) return null

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
                Arraste pela alça ⠿ ou use as setas para ordenar
              </p>

              {/* Grupos musculares reordenáveis */}
              <SortableList
                items={groups}
                getKey={mg => mg}
                onReorder={(from, to) => reorderGroups(day.id, from, to)}
                className="space-y-2"
                renderItem={(mg, { index: gIdx, isDragging, handleProps, setItemRef }) => {
                  const key = `${day.id}_${mg}`
                  const selected = selectedExercisesByDay[key] || []
                  return (
                    <div
                      ref={setItemRef}
                      className={`border rounded-xl overflow-hidden bg-[#1a1a1a] transition-all ${
                        isDragging ? 'border-red-500 ring-1 ring-red-500 shadow-lg' : 'border-zinc-800'
                      }`}
                    >
                      {/* Header do grupo — alça + setas */}
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-[#232323]/60">
                        <span
                          {...handleProps}
                          className="text-zinc-500 hover:text-zinc-200 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none p-1 -m-1"
                          title="Arraste para reordenar o grupo"
                        >
                          <GripIcon className="w-4 h-4" />
                        </span>
                        <span className="text-xs font-bold text-red-500 uppercase tracking-widest truncate flex-1">
                          {muscleGroupLabels[mg]}
                        </span>
                        <span className="text-[10px] text-zinc-600 flex-shrink-0">{selected.length} exec.</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => reorderGroups(day.id, gIdx, gIdx - 1)}
                            disabled={gIdx === 0}
                            className="w-7 h-7 flex items-center justify-center rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                            title="Mover grupo para cima"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
                          </button>
                          <button
                            onClick={() => reorderGroups(day.id, gIdx, gIdx + 1)}
                            disabled={gIdx === groups.length - 1}
                            className="w-7 h-7 flex items-center justify-center rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                            title="Mover grupo para baixo"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                          </button>
                        </div>
                      </div>

                      {/* Exercícios reordenáveis */}
                      <div className="p-3">
                        <SortableList
                          items={selected}
                          getKey={item => item.name}
                          onReorder={(from, to) => reorderExercise(key, from, to)}
                          className="space-y-2"
                          renderItem={(item, { index: idx, isDragging: exDragging, handleProps: exHandle, setItemRef: setExRef }) => (
                            <div
                              ref={setExRef}
                              className={`rounded-lg border p-2.5 transition-all ${
                                exDragging ? 'border-red-500 ring-1 ring-red-500 shadow-lg bg-[#232323]' : 'border-zinc-800 bg-[#232323]/40'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span
                                  {...exHandle}
                                  className="text-zinc-500 hover:text-zinc-200 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none p-1 -m-1"
                                  title="Arraste para reordenar o exercício"
                                >
                                  <GripIcon className="w-4 h-4" />
                                </span>
                                <PositionInput
                                  value={idx + 1}
                                  max={selected.length}
                                  onCommit={n => setExercisePosition(key, idx, n)}
                                  title="Posição na sequência"
                                  className="!px-0 !py-0.5 w-8 text-center text-[11px] font-mono font-bold text-zinc-300 flex-shrink-0"
                                />
                                <p className="text-xs text-zinc-100 font-semibold truncate flex-1">{item.name}</p>
                                <div className="flex gap-1 flex-shrink-0">
                                  <button onClick={() => reorderExercise(key, idx, idx - 1)} disabled={idx === 0}
                                    className="w-7 h-7 flex items-center justify-center rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                    title="Mover para cima">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
                                  </button>
                                  <button onClick={() => reorderExercise(key, idx, idx + 1)} disabled={idx === selected.length - 1}
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
                                    onChange={e => updateField(key, item.name, 'series', e.target.value)} className="w-full" />
                                </div>
                                <div>
                                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Reps alvo</p>
                                  <input type="text" placeholder="8-12" value={item.repeticoes}
                                    onChange={e => updateField(key, item.name, 'repeticoes', e.target.value)} className="w-full" />
                                </div>
                                <div>
                                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Carga (kg)</p>
                                  <input type="number" placeholder="0" value={item.carga}
                                    onChange={e => updateField(key, item.name, 'carga', e.target.value)} className="w-full" />
                                </div>
                                <div>
                                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Descanso (s)</p>
                                  <input type="number" min="0" placeholder="60" value={item.descanso ?? '60'}
                                    onChange={e => updateField(key, item.name, 'descanso', e.target.value)} className="w-full" />
                                </div>
                              </div>
                              <input type="text" placeholder="Observações (ex: halteres, pegada pronada...)"
                                value={item.observacoes}
                                onChange={e => updateField(key, item.name, 'observacoes', e.target.value)}
                                className="w-full !px-2 !py-1.5 text-sm mt-2 ml-0 md:ml-6 md:w-[calc(100%-1.5rem)]" />
                            </div>
                          )}
                        />
                      </div>
                    </div>
                  )
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
