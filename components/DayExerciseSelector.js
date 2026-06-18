import { formatConfigs, exercisesByMuscleGroup, muscleGroupLabels } from '../lib/workoutConfig'

export default function DayExerciseSelector({ format, selectedMusclesByDay, selectedExercisesByDay, onChange }) {
  const config = formatConfigs[format]
  if (!config) return null

  function toggleExercise(dayId, muscleGroup, exercise) {
    const key = `${dayId}_${muscleGroup}`
    const current = selectedExercisesByDay[key] || []
    const exists = current.some(e => e.name === exercise)
    const next = exists
      ? current.filter(e => e.name !== exercise)
      : [...current, { name: exercise, series: '3', repeticoes: '', carga: '', descanso: '60', observacoes: '' }]
    onChange({ ...selectedExercisesByDay, [key]: next })
  }

  function updateField(dayId, muscleGroup, exercise, field, value) {
    const key = `${dayId}_${muscleGroup}`
    const current = selectedExercisesByDay[key] || []
    const next = current.map(e => e.name === exercise ? { ...e, [field]: value } : e)
    onChange({ ...selectedExercisesByDay, [key]: next })
  }

  return (
    <div className="space-y-4">
      {config.days.map(day => {
        const muscleGroups = selectedMusclesByDay[day.id] || []

        if (muscleGroups.length === 0) {
          return (
            <div key={day.id} className="border border-zinc-800 rounded-xl p-3">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{day.name} · {day.label}</p>
              <p className="text-zinc-500 text-xs mt-1">Selecione grupos musculares no passo anterior.</p>
            </div>
          )
        }

        return (
          <div key={day.id} className="border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 bg-[#232323]">
              <p className="font-heading font-bold text-white uppercase tracking-wide text-sm">
                {day.name} · <span className="text-zinc-400">{day.label}</span>
              </p>
            </div>

            <div className="divide-y divide-zinc-800/60">
              {muscleGroups.map(mg => {
                const key = `${day.id}_${mg}`
                const selected = selectedExercisesByDay[key] || []
                return (
                  <div key={mg} className="p-3">
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-2">
                      {muscleGroupLabels[mg]}
                    </p>

                    {/* Botões de exercícios */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {(exercisesByMuscleGroup[mg] || []).map(ex => {
                        const isSelected = selected.some(e => e.name === ex)
                        return (
                          <button
                            key={ex}
                            onClick={() => toggleExercise(day.id, mg, ex)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                              isSelected
                                ? 'bg-red-600/20 border-red-600 text-red-400'
                                : 'bg-[#1a1a1a] border-zinc-700 text-zinc-300 hover:border-zinc-500'
                            }`}
                          >
                            {ex}
                          </button>
                        )
                      })}
                    </div>

                    {/* Config de cada exercício selecionado */}
                    {selected.length > 0 && (
                      <div className="space-y-3 pt-2 border-t border-zinc-800/60">
                        {selected.map(item => (
                          <div key={item.name}>
                            <p className="text-xs text-zinc-200 font-semibold mb-2">{item.name}</p>

                            {/* 4 campos em 2x2 */}
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <div>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Séries</p>
                                <input
                                  type="number"
                                  min="1" max="10"
                                  placeholder="3"
                                  value={item.series ?? '3'}
                                  onChange={e => updateField(day.id, mg, item.name, 'series', e.target.value)}
                                  className="w-full"
                                />
                              </div>
                              <div>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Reps alvo</p>
                                <input
                                  type="text"
                                  placeholder="8-12"
                                  value={item.repeticoes}
                                  onChange={e => updateField(day.id, mg, item.name, 'repeticoes', e.target.value)}
                                  className="w-full"
                                />
                              </div>
                              <div>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Carga (kg)</p>
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={item.carga}
                                  onChange={e => updateField(day.id, mg, item.name, 'carga', e.target.value)}
                                  className="w-full"
                                />
                              </div>
                              <div>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Descanso (s)</p>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="60"
                                  value={item.descanso ?? '60'}
                                  onChange={e => updateField(day.id, mg, item.name, 'descanso', e.target.value)}
                                  className="w-full"
                                />
                              </div>
                            </div>

                            {/* Observações */}
                            <input
                              type="text"
                              placeholder="Observações (ex: halteres, pegada pronada...)"
                              value={item.observacoes}
                              onChange={e => updateField(day.id, mg, item.name, 'observacoes', e.target.value)}
                              className="!px-2 !py-1.5 text-sm w-full"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
