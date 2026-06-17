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
    <div className="space-y-6">
      {config.days.map(day => {
        const muscleGroups = selectedMusclesByDay[day.id] || []

        if (muscleGroups.length === 0) {
          return (
            <div key={day.id} className="bg-[#1a1a1a] border border-zinc-800 rounded-xl p-5">
              <h3 className="font-heading font-bold text-white uppercase tracking-wide mb-1">
                {day.name} · <span className="text-zinc-500">{day.label}</span>
              </h3>
              <p className="text-zinc-600 text-sm">Selecione grupos musculares no passo anterior.</p>
            </div>
          )
        }

        return (
          <div key={day.id} className="bg-[#1a1a1a] border border-zinc-800 rounded-xl p-5">
            <h3 className="font-heading font-bold text-white uppercase tracking-wide mb-4">
              {day.name} · <span className="text-zinc-400">{day.label}</span>
            </h3>
            <div className="space-y-5">
              {muscleGroups.map(mg => {
                const key = `${day.id}_${mg}`
                const selected = selectedExercisesByDay[key] || []
                return (
                  <div key={mg} className="bg-[#232323] rounded-lg p-4 border border-zinc-800">
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-red-500 mb-3">
                      {muscleGroupLabels[mg]}
                    </h4>
                    <div className="grid grid-cols-2 gap-1.5 mb-4">
                      {(exercisesByMuscleGroup[mg] || []).map(ex => {
                        const isSelected = selected.some(e => e.name === ex)
                        return (
                          <button
                            key={ex}
                            onClick={() => toggleExercise(day.id, mg, ex)}
                            className={`px-3 py-2 rounded-lg border text-left text-xs font-medium transition-all ${
                              isSelected
                                ? 'bg-red-600/20 border-red-600 text-red-400'
                                : 'bg-[#1a1a1a] border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                            }`}
                          >
                            {ex}
                          </button>
                        )
                      })}
                    </div>

                    {selected.length > 0 && (
                      <div className="border-t border-zinc-700 pt-4 space-y-4">
                        {selected.map(item => (
                          <div key={item.name}>
                            <p className="text-xs text-zinc-300 font-semibold mb-2">{item.name}</p>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <div>
                                <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Séries</p>
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  placeholder="3"
                                  value={item.series ?? '3'}
                                  onChange={e => updateField(day.id, mg, item.name, 'series', e.target.value)}
                                />
                              </div>
                              <div>
                                <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Alvo de reps</p>
                                <input
                                  type="text"
                                  placeholder="8-12"
                                  value={item.repeticoes}
                                  onChange={e => updateField(day.id, mg, item.name, 'repeticoes', e.target.value)}
                                />
                              </div>
                              <div>
                                <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Carga (kg)</p>
                                <input
                                  type="text"
                                  placeholder="Ex: 60"
                                  value={item.carga}
                                  onChange={e => updateField(day.id, mg, item.name, 'carga', e.target.value)}
                                />
                              </div>
                              <div>
                                <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Descanso (seg)</p>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="60"
                                  value={item.descanso ?? '60'}
                                  onChange={e => updateField(day.id, mg, item.name, 'descanso', e.target.value)}
                                />
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Observações</p>
                              <input
                                type="text"
                                placeholder="Ex: Barra, pegada pronada..."
                                value={item.observacoes}
                                onChange={e => updateField(day.id, mg, item.name, 'observacoes', e.target.value)}
                              />
                            </div>
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
