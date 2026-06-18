import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { formatConfigs, exercisesByMuscleGroup, muscleGroupLabels } from '../lib/workoutConfig'

export default function DayExerciseSelector({ format, selectedMusclesByDay, selectedExercisesByDay, onChange }) {
  const { data: session } = useSession()
  const config = formatConfigs[format]
  const [customExercises, setCustomExercises] = useState({}) // { muscleGroup: { id, name }[] }
  const [hiddenExercises, setHiddenExercises] = useState(new Set())
  const [addingTo, setAddingTo] = useState(null)
  const [newExName, setNewExName] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    fetch('/api/hidden-exercises')
      .then(r => r.json())
      .then(data => setHiddenExercises(new Set((Array.isArray(data) ? data : []).map(e => e.name))))
  }, [])

  useEffect(() => {
    if (!session) return
    fetch(`/api/exercises?email=${session.user.email}`)
      .then(r => r.json())
      .then(data => {
        const grouped = {}
        ;(Array.isArray(data) ? data : []).forEach(ex => {
          if (!grouped[ex.muscleGroup]) grouped[ex.muscleGroup] = []
          grouped[ex.muscleGroup].push({ id: ex.id, name: ex.name })
        })
        setCustomExercises(grouped)
      })
  }, [session])

  useEffect(() => {
    if (addingTo && inputRef.current) inputRef.current.focus()
  }, [addingTo])

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

  function moveExercise(dayId, muscleGroup, fromIndex, toIndex) {
    const key = `${dayId}_${muscleGroup}`
    const current = [...(selectedExercisesByDay[key] || [])]
    const [moved] = current.splice(fromIndex, 1)
    current.splice(toIndex, 0, moved)
    onChange({ ...selectedExercisesByDay, [key]: current })
  }

  async function saveCustomExercise(muscleGroup) {
    const name = newExName.trim()
    if (!name || !session) return

    const existingNames = [
      ...(exercisesByMuscleGroup[muscleGroup] || []),
      ...(customExercises[muscleGroup] || []).map(e => e.name),
    ]
    if (existingNames.some(e => e.toLowerCase() === name.toLowerCase())) {
      setNewExName('')
      setAddingTo(null)
      return
    }

    const tempId = Date.now()
    setCustomExercises(prev => ({
      ...prev,
      [muscleGroup]: [...(prev[muscleGroup] || []), { id: tempId, name }],
    }))
    setNewExName('')
    setAddingTo(null)

    const res = await fetch('/api/exercises', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail: session.user.email, muscleGroup, name }),
    })
    const saved = await res.json()
    setCustomExercises(prev => ({
      ...prev,
      [muscleGroup]: (prev[muscleGroup] || []).map(e => e.id === tempId ? { id: saved.id, name: saved.name } : e),
    }))
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
                const allExercises = [
                  ...(exercisesByMuscleGroup[mg] || []).filter(ex => !hiddenExercises.has(ex)),
                  ...(customExercises[mg] || []).map(e => e.name),
                ]
                const isAddingHere = addingTo === key

                return (
                  <div key={mg} className="p-3">
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-2">
                      {muscleGroupLabels[mg]}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {allExercises.map(ex => {
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

                      {isAddingHere ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            ref={inputRef}
                            type="text"
                            value={newExName}
                            onChange={e => setNewExName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveCustomExercise(mg)
                              if (e.key === 'Escape') { setAddingTo(null); setNewExName('') }
                            }}
                            placeholder="Nome do exercício"
                            className="!px-2 !py-1 text-xs w-40"
                          />
                          <button
                            onClick={() => saveCustomExercise(mg)}
                            disabled={!newExName.trim()}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 transition-colors flex-shrink-0"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => { setAddingTo(null); setNewExName('') }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors flex-shrink-0"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAddingTo(key); setNewExName('') }}
                          className="px-3 py-1.5 rounded-lg border border-dashed border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 text-xs font-medium transition-all"
                        >
                          + Novo
                        </button>
                      )}
                    </div>

                    {selected.length > 0 && (
                      <div className="space-y-3 pt-2 border-t border-zinc-800/60">
                        {selected.map((item, idx) => (
                          <div key={item.name}>
                            <div className="flex items-center justify-between mb-2 gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[10px] font-mono text-zinc-600 flex-shrink-0 w-4 text-right">{idx + 1}</span>
                                <p className="text-xs text-zinc-200 font-semibold truncate">{item.name}</p>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <button
                                  onClick={() => moveExercise(day.id, mg, idx, idx - 1)}
                                  disabled={idx === 0}
                                  className="w-6 h-6 flex items-center justify-center rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => moveExercise(day.id, mg, idx, idx + 1)}
                                  disabled={idx === selected.length - 1}
                                  className="w-6 h-6 flex items-center justify-center rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <div>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Séries</p>
                                <input type="number" min="1" max="10" placeholder="3" value={item.series ?? '3'}
                                  onChange={e => updateField(day.id, mg, item.name, 'series', e.target.value)} className="w-full" />
                              </div>
                              <div>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Reps alvo</p>
                                <input type="text" placeholder="8-12" value={item.repeticoes}
                                  onChange={e => updateField(day.id, mg, item.name, 'repeticoes', e.target.value)} className="w-full" />
                              </div>
                              <div>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Carga (kg)</p>
                                <input type="number" placeholder="0" value={item.carga}
                                  onChange={e => updateField(day.id, mg, item.name, 'carga', e.target.value)} className="w-full" />
                              </div>
                              <div>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Descanso (s)</p>
                                <input type="number" min="0" placeholder="60" value={item.descanso ?? '60'}
                                  onChange={e => updateField(day.id, mg, item.name, 'descanso', e.target.value)} className="w-full" />
                              </div>
                            </div>
                            <input type="text" placeholder="Observações (ex: halteres, pegada pronada...)"
                              value={item.observacoes}
                              onChange={e => updateField(day.id, mg, item.name, 'observacoes', e.target.value)}
                              className="w-full !px-2 !py-1.5 text-sm" />
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
