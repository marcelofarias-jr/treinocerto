import { formatConfigs, muscleGroupLabels } from '../lib/workoutConfig'

export default function DayMuscleGroupSelector({ format, selectedByDay, onChange }) {
  const config = formatConfigs[format]
  if (!config) return null

  function toggleMuscleGroup(dayId, muscleGroup) {
    const current = selectedByDay[dayId] || []
    const next = current.includes(muscleGroup)
      ? current.filter(m => m !== muscleGroup)
      : [...current, muscleGroup]
    onChange({ ...selectedByDay, [dayId]: next })
  }

  function moveMuscleGroup(dayId, fromIndex, toIndex) {
    const current = [...(selectedByDay[dayId] || [])]
    const [moved] = current.splice(fromIndex, 1)
    current.splice(toIndex, 0, moved)
    onChange({ ...selectedByDay, [dayId]: current })
  }

  return (
    <div className="space-y-4">
      {config.days.map(day => {
        const selected = selectedByDay[day.id] || []
        return (
          <div key={day.id} className="bg-[#1a1a1a] border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-5 h-5 bg-red-600 rounded flex items-center justify-center text-[10px] font-black text-white">
                {day.id}
              </span>
              <h3 className="font-heading font-bold text-white uppercase tracking-wide">
                {day.name} · <span className="text-zinc-400">{day.label}</span>
              </h3>
            </div>

            {/* Botões de seleção */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              {day.muscleGroups.map(mg => {
                const isSelected = selected.includes(mg)
                return (
                  <button
                    key={mg}
                    onClick={() => toggleMuscleGroup(day.id, mg)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium text-left transition-all ${
                      isSelected
                        ? 'bg-red-600 border-red-600 text-white'
                        : 'bg-[#232323] border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    {muscleGroupLabels[mg]}
                  </button>
                )
              })}
            </div>

            {/* Ordem dos grupos selecionados */}
            {selected.length > 1 && (
              <div className="border-t border-zinc-800 pt-3">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Ordem no treino</p>
                <div className="space-y-1.5">
                  {selected.map((mg, idx) => (
                    <div key={mg} className="flex items-center gap-2 bg-[#232323] rounded-lg px-3 py-2">
                      <span className="text-[10px] font-mono text-zinc-600 w-4 text-right flex-shrink-0">{idx + 1}</span>
                      <span className="flex-1 text-sm text-zinc-200">{muscleGroupLabels[mg]}</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => moveMuscleGroup(day.id, idx, idx - 1)}
                          disabled={idx === 0}
                          className="w-6 h-6 flex items-center justify-center rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveMuscleGroup(day.id, idx, idx + 1)}
                          disabled={idx === selected.length - 1}
                          className="w-6 h-6 flex items-center justify-center rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
