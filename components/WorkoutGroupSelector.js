import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { getFormatConfig, exercisesByMuscleGroup, muscleGroupLabels } from '../lib/workoutConfig'
import { apiFetch } from '../lib/api'
import { useToast } from './ToastProvider'

/*
 * PASSO 2 — Seleção de grupos musculares e exercícios (sem ordenação/config).
 * A ordem, séries, carga e descanso são definidos no passo 3 (WorkoutArranger).
 */
export default function WorkoutGroupSelector({
  format,
  variant,
  selectedMusclesByDay,
  selectedExercisesByDay,
  onMusclesChange,
  onExercisesChange,
}) {
  const { data: session } = useSession()
  const toast = useToast()
  const config = getFormatConfig(format, variant)

  const [customExercises, setCustomExercises] = useState({}) // { muscleGroup: {id,name}[] }
  const [hiddenExercises, setHiddenExercises] = useState(new Set())
  const [addingTo, setAddingTo] = useState(null)
  const [newExName, setNewExName] = useState('')
  const [collapsed, setCollapsed] = useState({}) // { key: true } → colapsado
  const inputRef = useRef(null)

  useEffect(() => {
    fetch('/api/hidden-exercises')
      .then(r => r.json())
      .then(data => setHiddenExercises(new Set((Array.isArray(data) ? data : []).map(e => e.name))))
  }, [])

  useEffect(() => {
    if (!session) return
    fetch('/api/exercises')
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

  function toggleMuscleGroup(dayId, mg) {
    const current = selectedMusclesByDay[dayId] || []
    const next = current.includes(mg) ? current.filter(m => m !== mg) : [...current, mg]
    onMusclesChange({ ...selectedMusclesByDay, [dayId]: next })
  }

  function toggleExercise(dayId, mg, exercise) {
    const key = `${dayId}_${mg}`
    const current = selectedExercisesByDay[key] || []
    const exists = current.some(e => e.name === exercise)
    const next = exists
      ? current.filter(e => e.name !== exercise)
      : [...current, { name: exercise, series: '3', repeticoes: '', carga: '', descanso: '60', observacoes: '' }]
    onExercisesChange({ ...selectedExercisesByDay, [key]: next })
  }

  async function saveCustomExercise(mg) {
    const name = newExName.trim()
    if (!name || !session) return
    const existingNames = [
      ...(exercisesByMuscleGroup[mg] || []),
      ...(customExercises[mg] || []).map(e => e.name),
    ]
    if (existingNames.some(e => e.toLowerCase() === name.toLowerCase())) {
      setNewExName(''); setAddingTo(null); return
    }
    const tempId = `tmp-${name}`
    setCustomExercises(prev => ({ ...prev, [mg]: [...(prev[mg] || []), { id: tempId, name }] }))
    setNewExName(''); setAddingTo(null)
    try {
      const saved = await apiFetch('/api/exercises', { json: { muscleGroup: mg, name } })
      setCustomExercises(prev => ({
        ...prev,
        [mg]: (prev[mg] || []).map(e => e.id === tempId ? { id: saved.id, name: saved.name } : e),
      }))
    } catch (err) {
      // Remove o otimista: sem isso o exercício aparecia na lista e não existia
      // no banco, então sumia no próximo carregamento.
      setCustomExercises(prev => ({
        ...prev,
        [mg]: (prev[mg] || []).filter(e => e.id !== tempId),
      }))
      toast(err.message, 'error')
    }
  }

  return (
    <div className="space-y-4">
      {config.days.map(day => {
        const selectedGroups = selectedMusclesByDay[day.id] || []

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
              {selectedGroups.length > 0 && (
                <span className="ml-auto text-[10px] text-zinc-500 uppercase tracking-widest">
                  {selectedGroups.length} {selectedGroups.length === 1 ? 'grupo' : 'grupos'}
                </span>
              )}
            </div>

            <div className="p-4">
              {/* Paleta: quais grupos treinar neste dia */}
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Toque para adicionar grupos</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                {day.muscleGroups.map(mg => {
                  const isSelected = selectedGroups.includes(mg)
                  const count = (selectedExercisesByDay[`${day.id}_${mg}`] || []).length
                  return (
                    <button
                      key={mg}
                      onClick={() => toggleMuscleGroup(day.id, mg)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium text-left transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'bg-[#232323] border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                      }`}
                    >
                      <span className="truncate">{muscleGroupLabels[mg]}</span>
                      {isSelected && (
                        <span className="flex-shrink-0 flex items-center gap-1">
                          {count > 0 && <span className="text-[10px] font-bold opacity-90">{count}</span>}
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {selectedGroups.length === 0 ? (
                <p className="text-zinc-500 text-xs py-2">Selecione ao menos um grupo muscular para escolher os exercícios.</p>
              ) : (
                <div className="space-y-2">
                  {selectedGroups.map(mg => {
                    const key = `${day.id}_${mg}`
                    const selected = selectedExercisesByDay[key] || []
                    const allExercises = [
                      ...(exercisesByMuscleGroup[mg] || []).filter(ex => !hiddenExercises.has(ex)),
                      ...(customExercises[mg] || []).map(e => e.name),
                    ]
                    const isAddingHere = addingTo === key
                    const isCollapsed = collapsed[key] === true

                    return (
                      <div key={mg} className="border border-zinc-800 rounded-xl overflow-hidden bg-[#1a1a1a]">
                        {/* Header do grupo — colapsar */}
                        <button
                          onClick={() => setCollapsed(prev => ({ ...prev, [key]: !isCollapsed }))}
                          className="w-full flex items-center gap-2 px-3 py-2.5 bg-[#232323]/60 text-left"
                        >
                          <svg className={`w-3.5 h-3.5 text-zinc-500 transition-transform flex-shrink-0 ${isCollapsed ? '-rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                          </svg>
                          <span className="text-xs font-bold text-red-500 uppercase tracking-widest truncate flex-1">
                            {muscleGroupLabels[mg]}
                          </span>
                          <span className="text-[10px] text-zinc-600 flex-shrink-0">
                            {selected.length > 0 ? `${selected.length} selec.` : 'nenhum'}
                          </span>
                        </button>

                        {/* Corpo: pills de exercícios */}
                        {!isCollapsed && (
                          <div className="p-3">
                            <div className="flex flex-wrap gap-1.5">
                              {allExercises.map(ex => {
                                const isSel = selected.some(e => e.name === ex)
                                return (
                                  <button
                                    key={ex}
                                    onClick={() => toggleExercise(day.id, mg, ex)}
                                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                      isSel
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
                                  <button onClick={() => saveCustomExercise(mg)} disabled={!newExName.trim()}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 transition-colors flex-shrink-0">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                  </button>
                                  <button onClick={() => { setAddingTo(null); setNewExName('') }}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors flex-shrink-0">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => { setAddingTo(key); setNewExName('') }}
                                  className="px-3 py-1.5 rounded-lg border border-dashed border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 text-xs font-medium transition-all">
                                  + Novo
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
