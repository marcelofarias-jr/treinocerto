import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { formatConfigs, exercisesByMuscleGroup, muscleGroupLabels } from '../lib/workoutConfig'

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

export default function WorkoutDayBuilder({
  format,
  selectedMusclesByDay,
  selectedExercisesByDay,
  onMusclesChange,
  onExercisesChange,
}) {
  const { data: session } = useSession()
  const config = formatConfigs[format]

  const [customExercises, setCustomExercises] = useState({}) // { muscleGroup: {id,name}[] }
  const [hiddenExercises, setHiddenExercises] = useState(new Set())
  const [addingTo, setAddingTo] = useState(null)
  const [newExName, setNewExName] = useState('')
  const [collapsed, setCollapsed] = useState({})   // { `${dayId}_${mg}`: true } → colapsado
  const [activeTab, setActiveTab] = useState({})    // { [dayId]: mg } → aba ativa no mobile
  const [dragGroup, setDragGroup] = useState(null)  // { dayId, index }
  const [dragOverGroup, setDragOverGroup] = useState(null) // { dayId, index }
  const [dragEx, setDragEx] = useState(null)        // { key, index }
  const [dragOverEx, setDragOverEx] = useState(null) // { key, index }
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

  /* ── Grupos musculares ── */
  function toggleMuscleGroup(dayId, mg) {
    const current = selectedMusclesByDay[dayId] || []
    const next = current.includes(mg) ? current.filter(m => m !== mg) : [...current, mg]
    onMusclesChange({ ...selectedMusclesByDay, [dayId]: next })
    // ao adicionar, foca a aba no grupo recém-incluído (mobile)
    if (!current.includes(mg)) setActiveTab(prev => ({ ...prev, [dayId]: mg }))
  }

  function reorderMuscleGroups(dayId, from, to) {
    const current = [...(selectedMusclesByDay[dayId] || [])]
    if (to < 0 || to >= current.length) return
    const [moved] = current.splice(from, 1)
    current.splice(to, 0, moved)
    onMusclesChange({ ...selectedMusclesByDay, [dayId]: current })
  }

  /* ── Exercícios ── */
  function toggleExercise(dayId, mg, exercise) {
    const key = `${dayId}_${mg}`
    const current = selectedExercisesByDay[key] || []
    const exists = current.some(e => e.name === exercise)
    const next = exists
      ? current.filter(e => e.name !== exercise)
      : [...current, { name: exercise, series: '3', repeticoes: '', carga: '', descanso: '60', observacoes: '' }]
    onExercisesChange({ ...selectedExercisesByDay, [key]: next })
  }

  function updateField(dayId, mg, exercise, field, value) {
    const key = `${dayId}_${mg}`
    const current = selectedExercisesByDay[key] || []
    const next = current.map(e => e.name === exercise ? { ...e, [field]: value } : e)
    onExercisesChange({ ...selectedExercisesByDay, [key]: next })
  }

  function reorderExercise(key, from, to) {
    const current = [...(selectedExercisesByDay[key] || [])]
    if (to < 0 || to >= current.length) return
    const [moved] = current.splice(from, 1)
    current.splice(to, 0, moved)
    onExercisesChange({ ...selectedExercisesByDay, [key]: current })
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
    const tempId = Date.now()
    setCustomExercises(prev => ({ ...prev, [mg]: [...(prev[mg] || []), { id: tempId, name }] }))
    setNewExName(''); setAddingTo(null)
    const res = await fetch('/api/exercises', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail: session.user.email, muscleGroup: mg, name }),
    })
    const saved = await res.json()
    setCustomExercises(prev => ({
      ...prev,
      [mg]: (prev[mg] || []).map(e => e.id === tempId ? { id: saved.id, name: saved.name } : e),
    }))
  }

  /* ── Drag & drop dos grupos ── */
  function onGroupDrop(dayId, dropIdx) {
    if (!dragGroup || dragGroup.dayId !== dayId || dragGroup.index === dropIdx) return
    reorderMuscleGroups(dayId, dragGroup.index, dropIdx)
  }

  /* ── Drag & drop dos exercícios ── */
  function onExDrop(key, dropIdx) {
    if (!dragEx || dragEx.key !== key || dragEx.index === dropIdx) return
    reorderExercise(key, dragEx.index, dropIdx)
  }

  return (
    <div className="space-y-4">
      {config.days.map(day => {
        const selectedGroups = selectedMusclesByDay[day.id] || []
        const active = activeTab[day.id] || selectedGroups[0]

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
                <>
                  {/* MOBILE: abas horizontais dos grupos selecionados */}
                  <div className="md:hidden -mx-4 px-4 mb-3 border-b border-zinc-800">
                    <div className="flex gap-1 overflow-x-auto pb-px">
                      {selectedGroups.map(mg => {
                        const count = (selectedExercisesByDay[`${day.id}_${mg}`] || []).length
                        const isActive = active === mg
                        return (
                          <button
                            key={mg}
                            onClick={() => setActiveTab(prev => ({ ...prev, [day.id]: mg }))}
                            className={`flex-shrink-0 px-3 py-2 text-xs font-semibold uppercase tracking-widest whitespace-nowrap border-b-2 transition-colors ${
                              isActive ? 'border-red-600 text-white' : 'border-transparent text-zinc-500'
                            }`}
                          >
                            {muscleGroupLabels[mg]}
                            {count > 0 && <span className="ml-1 text-red-500">{count}</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Cada grupo selecionado: accordion (desktop) / painel da aba (mobile) */}
                  <div className="space-y-2">
                    {selectedGroups.map((mg, gIdx) => {
                      const key = `${day.id}_${mg}`
                      const selected = selectedExercisesByDay[key] || []
                      const allExercises = [
                        ...(exercisesByMuscleGroup[mg] || []).filter(ex => !hiddenExercises.has(ex)),
                        ...(customExercises[mg] || []).map(e => e.name),
                      ]
                      const isAddingHere = addingTo === key
                      const isCollapsed = collapsed[key] === true
                      const isDragOver = dragOverGroup?.dayId === day.id && dragOverGroup?.index === gIdx && dragGroup?.index !== gIdx

                      // No mobile só renderiza o grupo da aba ativa; no desktop, todos.
                      const mobileHidden = active !== mg

                      return (
                        <div
                          key={mg}
                          onDragOver={e => { if (dragGroup?.dayId === day.id) { e.preventDefault(); setDragOverGroup({ dayId: day.id, index: gIdx }) } }}
                          onDrop={() => { onGroupDrop(day.id, gIdx); setDragGroup(null); setDragOverGroup(null) }}
                          className={`border rounded-xl overflow-hidden bg-[#1a1a1a] transition-all ${mobileHidden ? 'hidden md:block' : ''} ${
                            isDragOver ? 'border-red-500 ring-1 ring-red-500' : 'border-zinc-800'
                          } ${dragGroup?.dayId === day.id && dragGroup?.index === gIdx ? 'opacity-40' : ''}`}
                        >
                          {/* Header do grupo — arrastável (desktop) + toggle accordion */}
                          <div className="flex items-center gap-2 px-3 py-2.5 bg-[#232323]/60">
                            {/* Alça de arraste (desktop) */}
                            <span
                              draggable
                              onDragStart={() => setDragGroup({ dayId: day.id, index: gIdx })}
                              onDragEnd={() => { setDragGroup(null); setDragOverGroup(null) }}
                              className="hidden md:flex text-zinc-600 hover:text-zinc-300 cursor-grab active:cursor-grabbing flex-shrink-0"
                              title="Arraste para reordenar"
                            >
                              <GripIcon className="w-4 h-4" />
                            </span>

                            {/* Nome + expandir (desktop clica pra colapsar) */}
                            <button
                              onClick={() => setCollapsed(prev => ({ ...prev, [key]: !isCollapsed }))}
                              className="hidden md:flex items-center gap-2 flex-1 min-w-0 text-left"
                            >
                              <svg className={`w-3.5 h-3.5 text-zinc-500 transition-transform flex-shrink-0 ${isCollapsed ? '-rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                              </svg>
                              <span className="text-xs font-bold text-red-500 uppercase tracking-widest truncate">
                                {muscleGroupLabels[mg]}
                              </span>
                              <span className="text-[10px] text-zinc-600 flex-shrink-0">
                                {selected.length > 0 ? `${selected.length} exec.` : 'vazio'}
                              </span>
                            </button>

                            {/* Mobile: só o nome (sem colapsar, já é aba) */}
                            <span className="md:hidden flex-1 text-xs font-bold text-red-500 uppercase tracking-widest">
                              {muscleGroupLabels[mg]}
                            </span>

                            {/* Reordenar (setas) — reserva p/ toque */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => reorderMuscleGroups(day.id, gIdx, gIdx - 1)}
                                disabled={gIdx === 0}
                                className="w-6 h-6 flex items-center justify-center rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                title="Mover para cima"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
                              </button>
                              <button
                                onClick={() => reorderMuscleGroups(day.id, gIdx, gIdx + 1)}
                                disabled={gIdx === selectedGroups.length - 1}
                                className="w-6 h-6 flex items-center justify-center rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                title="Mover para baixo"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                              </button>
                              <button
                                onClick={() => toggleMuscleGroup(day.id, mg)}
                                className="w-6 h-6 flex items-center justify-center rounded border border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-800 transition-colors"
                                title="Remover grupo"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          </div>

                          {/* Corpo do grupo: exercícios */}
                          {!isCollapsed && (
                            <div className="p-3">
                              {/* Pills de exercícios disponíveis */}
                              <div className="flex flex-wrap gap-1.5 mb-3">
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

                              {/* Exercícios selecionados + config (arrastáveis) */}
                              {selected.length > 0 && (
                                <div className="space-y-2 pt-2 border-t border-zinc-800/60">
                                  {selected.map((item, idx) => {
                                    const exDragOver = dragOverEx?.key === key && dragOverEx?.index === idx && dragEx?.index !== idx
                                    const exDragging = dragEx?.key === key && dragEx?.index === idx
                                    return (
                                      <div
                                        key={item.name}
                                        onDragOver={e => { if (dragEx?.key === key) { e.preventDefault(); setDragOverEx({ key, index: idx }) } }}
                                        onDrop={() => { onExDrop(key, idx); setDragEx(null); setDragOverEx(null) }}
                                        className={`rounded-lg border p-2.5 transition-all ${
                                          exDragOver ? 'border-red-500 ring-1 ring-red-500' : 'border-zinc-800'
                                        } ${exDragging ? 'opacity-40' : 'bg-[#232323]/40'}`}
                                      >
                                        <div className="flex items-center gap-2 mb-2">
                                          <span
                                            draggable
                                            onDragStart={() => setDragEx({ key, index: idx })}
                                            onDragEnd={() => { setDragEx(null); setDragOverEx(null) }}
                                            className="text-zinc-600 hover:text-zinc-300 cursor-grab active:cursor-grabbing flex-shrink-0"
                                            title="Arraste para reordenar"
                                          >
                                            <GripIcon className="w-4 h-4" />
                                          </span>
                                          <span className="text-[10px] font-mono text-zinc-600 flex-shrink-0 w-4 text-right">{idx + 1}</span>
                                          <p className="text-xs text-zinc-100 font-semibold truncate flex-1">{item.name}</p>
                                          <div className="flex gap-1 flex-shrink-0 md:hidden">
                                            <button onClick={() => reorderExercise(key, idx, idx - 1)} disabled={idx === 0}
                                              className="w-6 h-6 flex items-center justify-center rounded border border-zinc-700 text-zinc-400 disabled:opacity-20 disabled:cursor-not-allowed">
                                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
                                            </button>
                                            <button onClick={() => reorderExercise(key, idx, idx + 1)} disabled={idx === selected.length - 1}
                                              className="w-6 h-6 flex items-center justify-center rounded border border-zinc-700 text-zinc-400 disabled:opacity-20 disabled:cursor-not-allowed">
                                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                                            </button>
                                          </div>
                                          <button onClick={() => toggleExercise(day.id, mg, item.name)}
                                            className="w-6 h-6 flex items-center justify-center rounded border border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-800 transition-colors flex-shrink-0"
                                            title="Remover exercício">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                          </button>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-6">
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
                                          className="w-full !px-2 !py-1.5 text-sm mt-2 ml-0 md:ml-6 md:w-[calc(100%-1.5rem)]" />
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
