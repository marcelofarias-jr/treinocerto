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

  return (
    <div className="space-y-4">
      {config.days.map(day => (
        <div key={day.id} className="bg-[#1a1a1a] border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-5 h-5 bg-red-600 rounded flex items-center justify-center text-[10px] font-black text-white">
              {typeof day.id === 'number' ? day.id : day.id}
            </span>
            <h3 className="font-heading font-bold text-white uppercase tracking-wide">
              {day.name} · <span className="text-zinc-400">{day.label}</span>
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {day.muscleGroups.map(mg => {
              const selected = (selectedByDay[day.id] || []).includes(mg)
              return (
                <button
                  key={mg}
                  onClick={() => toggleMuscleGroup(day.id, mg)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium text-left transition-all ${
                    selected
                      ? 'bg-red-600 border-red-600 text-white'
                      : 'bg-[#232323] border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {muscleGroupLabels[mg]}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
