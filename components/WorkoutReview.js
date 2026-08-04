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
 * PASSO 4 — Revisão final. Mostra a sequência completa do treino, numerada de
 * forma contínua por dia, e permite ajustar a ordem digitando o número da
 * posição (dentro do grupo) ou reordenando os grupos, antes de salvar.
 */
export default function WorkoutReview({
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

  // Reordena o exercício dentro do grupo pela posição digitada (contínua no
  // dia). Converte a posição global para o índice relativo ao grupo.
  function setPositionInGroup(key, from, globalPos, groupStart, groupLen) {
    const local = Math.min(Math.max(globalPos - groupStart, 1), groupLen) - 1
    if (local !== from) reorderExercise(key, from, local)
  }

  const daysWithContent = config.days
    .map(day => {
      const groups = (selectedMusclesByDay[day.id] || []).filter(
        mg => (selectedExercisesByDay[`${day.id}_${mg}`] || []).length > 0
      )
      return { day, groups }
    })
    .filter(d => d.groups.length > 0)

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
        ou reordene os grupos com as setas. Quando estiver tudo certo, salve o treino.
      </p>

      {daysWithContent.map(({ day, groups }) => {
        // Total de exercícios do dia — para numeração contínua.
        const dayTotal = groups.reduce(
          (t, mg) => t + (selectedExercisesByDay[`${day.id}_${mg}`] || []).length,
          0
        )
        let seq = 0 // contador contínuo dentro do dia

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
              <span className="ml-auto text-[10px] text-zinc-500 uppercase tracking-widest flex-shrink-0">
                {dayTotal} {dayTotal === 1 ? 'exercício' : 'exercícios'}
              </span>
            </div>

            <div className="p-3 space-y-3">
              {groups.map((mg, gIdx) => {
                const key = `${day.id}_${mg}`
                const exercises = selectedExercisesByDay[key] || []
                const groupStart = seq + 1 // primeira posição contínua deste grupo

                return (
                  <div key={mg}>
                    {/* Cabeçalho do grupo + setas de reordenação */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-bold text-red-500 uppercase tracking-widest flex-1 truncate">
                        {muscleGroupLabels[mg]}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => reorderGroups(day.id, gIdx, gIdx - 1)} disabled={gIdx === 0}
                          className="w-6 h-6 flex items-center justify-center rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          title="Mover grupo para cima">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
                        </button>
                        <button onClick={() => reorderGroups(day.id, gIdx, gIdx + 1)} disabled={gIdx === groups.length - 1}
                          className="w-6 h-6 flex items-center justify-center rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          title="Mover grupo para baixo">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {exercises.map((item, idx) => {
                        seq += 1
                        const summary = [
                          (item.series ?? '3') && `${item.series ?? '3'}× ${item.repeticoes || '—'}`,
                          item.carga ? `${item.carga}kg` : null,
                          item.descanso ? `${item.descanso}s desc.` : null,
                        ].filter(Boolean).join(' · ')

                        return (
                          <div key={item.name} className="flex items-center gap-2.5 rounded-lg border border-zinc-800 bg-[#232323]/40 px-2.5 py-2">
                            <PositionInput
                              value={seq}
                              max={dayTotal}
                              onCommit={n => setPositionInGroup(key, idx, n, groupStart, exercises.length)}
                              title="Posição na sequência"
                              className="!px-0 !py-1 w-9 text-center text-sm font-mono font-black text-red-500 flex-shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-zinc-100 font-semibold truncate">{item.name}</p>
                              <p className="text-[10px] text-zinc-500 truncate">{summary}</p>
                            </div>
                            {item.observacoes && (
                              <span className="text-[10px] text-zinc-500 italic truncate max-w-[35%] hidden sm:block flex-shrink-0">
                                {item.observacoes}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
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
