import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { exercisesByMuscleGroup, muscleGroupLabels } from '../../lib/workoutConfig'

const ADMIN_EMAIL = 'marcelobfariasjr@gmail.com'
const MUSCLE_GROUPS = Object.keys(muscleGroupLabels)

export default function AdminExercises() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [customExercises, setCustomExercises] = useState([])  // [{ id, muscleGroup, name }]
  const [hiddenExercises, setHiddenExercises] = useState(new Set()) // Set de nomes ocultos
  const [loading, setLoading] = useState(true)

  const [newName, setNewName] = useState('')
  const [newMuscle, setNewMuscle] = useState(MUSCLE_GROUPS[0])
  const [saving, setSaving] = useState(false)

  const [editingKey, setEditingKey] = useState(null) // 'builtin:name' | 'custom:id'
  const [editName, setEditName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null) // { type: 'builtin'|'custom', name, id, muscleGroup }

  const [filterMuscle, setFilterMuscle] = useState('all')

  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.email !== ADMIN_EMAIL) { router.push('/'); return }

    Promise.all([
      fetch(`/api/exercises?email=${session.user.email}`).then(r => r.json()),
      fetch('/api/hidden-exercises').then(r => r.json()),
    ]).then(([custom, hidden]) => {
      setCustomExercises(Array.isArray(custom) ? custom : [])
      setHiddenExercises(new Set((Array.isArray(hidden) ? hidden : []).map(e => e.name)))
      setLoading(false)
    })
  }, [session, status])

  if (status === 'loading' || loading) return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!session || session.user.email !== ADMIN_EMAIL) return null

  // ── Adicionar novo exercício customizado ──
  async function addExercise(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return

    const allNames = [
      ...(exercisesByMuscleGroup[newMuscle] || []),
      ...customExercises.filter(ex => ex.muscleGroup === newMuscle).map(ex => ex.name),
    ]
    if (allNames.some(n => n.toLowerCase() === name.toLowerCase())) return

    setSaving(true)
    const res = await fetch('/api/exercises', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail: session.user.email, muscleGroup: newMuscle, name }),
    })
    const saved = await res.json()
    setCustomExercises(prev => [...prev, saved])
    setNewName('')
    setSaving(false)
  }

  // ── Editar exercício padrão: oculta o original e cria um customizado ──
  async function saveEditBuiltin(originalName, muscleGroup) {
    const name = editName.trim()
    if (!name || name === originalName) { setEditingKey(null); return }

    await Promise.all([
      fetch('/api/hidden-exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: originalName, muscleGroup }),
      }),
      fetch('/api/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: session.user.email, muscleGroup, name }),
      }).then(r => r.json()).then(saved => {
        setCustomExercises(prev => [...prev, saved])
      }),
    ])
    setHiddenExercises(prev => new Set([...prev, originalName]))
    setEditingKey(null)
  }

  // ── Editar exercício customizado ──
  async function saveEditCustom(id) {
    const name = editName.trim()
    if (!name) { setEditingKey(null); return }
    const res = await fetch('/api/exercises', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name }),
    })
    const saved = await res.json()
    setCustomExercises(prev => prev.map(ex => ex.id === id ? { ...ex, name: saved.name } : ex))
    setEditingKey(null)
  }

  // ── Excluir exercício padrão: oculta ──
  async function deleteBuiltin(name, muscleGroup) {
    await fetch('/api/hidden-exercises', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, muscleGroup }),
    })
    setHiddenExercises(prev => new Set([...prev, name]))
    setConfirmDelete(null)
  }

  // ── Excluir exercício customizado ──
  async function deleteCustom(id) {
    await fetch('/api/exercises', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setCustomExercises(prev => prev.filter(ex => ex.id !== id))
    setConfirmDelete(null)
  }

  // ── Restaurar exercício padrão oculto ──
  async function restoreBuiltin(name) {
    await fetch('/api/hidden-exercises', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setHiddenExercises(prev => { const s = new Set(prev); s.delete(name); return s })
  }

  function handleConfirmedDelete() {
    if (!confirmDelete) return
    if (confirmDelete.type === 'builtin') deleteBuiltin(confirmDelete.name, confirmDelete.muscleGroup)
    else deleteCustom(confirmDelete.id)
  }

  const visibleMuscles = filterMuscle === 'all' ? MUSCLE_GROUPS : [filterMuscle]

  // Contagem total por grupo para os filtros
  const countByMuscle = {}
  MUSCLE_GROUPS.forEach(mg => {
    const builtin = (exercisesByMuscleGroup[mg] || []).length
    const custom = customExercises.filter(e => e.muscleGroup === mg).length
    countByMuscle[mg] = builtin + custom
  })

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        <div>
          <p className="text-[10px] text-red-500 uppercase tracking-widest mb-1">Admin</p>
          <h1 className="font-heading font-black text-4xl uppercase text-white">Exercícios</h1>
          <p className="text-zinc-400 text-sm mt-1">Gerencie todos os exercícios do app.</p>
        </div>

        {/* Formulário de criação */}
        <form onSubmit={addExercise} className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Novo exercício</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <select value={newMuscle} onChange={e => setNewMuscle(e.target.value)} className="sm:w-48 flex-shrink-0">
              {MUSCLE_GROUPS.map(mg => (
                <option key={mg} value={mg}>{muscleGroupLabels[mg]}</option>
              ))}
            </select>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Nome do exercício"
              className="flex-1"
            />
            <button
              type="submit"
              disabled={!newName.trim() || saving}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-heading font-bold uppercase tracking-widest text-sm rounded-xl transition-colors disabled:opacity-40 flex-shrink-0"
            >
              {saving ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </form>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterMuscle('all')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg border text-xs font-semibold uppercase tracking-wide transition-colors ${
              filterMuscle === 'all' ? 'bg-red-600 border-red-600 text-white' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
            }`}
          >
            Todos
          </button>
          {MUSCLE_GROUPS.map(mg => (
            <button
              key={mg}
              onClick={() => setFilterMuscle(mg)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg border text-xs font-semibold uppercase tracking-wide transition-colors ${
                filterMuscle === mg ? 'bg-red-600 border-red-600 text-white' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
              }`}
            >
              {muscleGroupLabels[mg]} <span className="ml-1 opacity-50">{countByMuscle[mg]}</span>
            </button>
          ))}
        </div>

        {/* Lista por grupo */}
        <div className="space-y-4">
          {visibleMuscles.map(mg => {
            const builtinList = exercisesByMuscleGroup[mg] || []
            const customList = customExercises.filter(e => e.muscleGroup === mg)
            const hiddenList = builtinList.filter(name => hiddenExercises.has(name))
            const visibleBuiltin = builtinList.filter(name => !hiddenExercises.has(name))

            if (builtinList.length === 0 && customList.length === 0) return null

            return (
              <div key={mg} className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-800 bg-[#232323] flex items-center justify-between">
                  <p className="text-xs font-bold text-red-500 uppercase tracking-widest">{muscleGroupLabels[mg]}</p>
                  <span className="text-xs text-zinc-600">
                    {visibleBuiltin.length + customList.length} ativos
                    {hiddenList.length > 0 && ` · ${hiddenList.length} ocultos`}
                  </span>
                </div>

                <div className="divide-y divide-zinc-800/60">
                  {/* Exercícios padrão visíveis */}
                  {visibleBuiltin.map(name => {
                    const key = `builtin:${name}`
                    const isEditing = editingKey === key
                    return (
                      <ExerciseRow
                        key={key}
                        name={name}
                        isEditing={isEditing}
                        editName={editName}
                        onEditChange={setEditName}
                        onEditStart={() => { setEditingKey(key); setEditName(name) }}
                        onEditSave={() => saveEditBuiltin(name, mg)}
                        onEditCancel={() => setEditingKey(null)}
                        onDelete={() => setConfirmDelete({ type: 'builtin', name, muscleGroup: mg })}
                      />
                    )
                  })}

                  {/* Exercícios customizados */}
                  {customList.map(ex => {
                    const key = `custom:${ex.id}`
                    const isEditing = editingKey === key
                    return (
                      <ExerciseRow
                        key={key}
                        name={ex.name}
                        badge="personalizado"
                        isEditing={isEditing}
                        editName={editName}
                        onEditChange={setEditName}
                        onEditStart={() => { setEditingKey(key); setEditName(ex.name) }}
                        onEditSave={() => saveEditCustom(ex.id)}
                        onEditCancel={() => setEditingKey(null)}
                        onDelete={() => setConfirmDelete({ type: 'custom', name: ex.name, id: ex.id })}
                      />
                    )
                  })}

                  {/* Exercícios padrão ocultos (restauráveis) */}
                  {hiddenList.map(name => (
                    <div key={`hidden:${name}`} className="px-5 py-3 flex items-center gap-3 opacity-40">
                      <span className="flex-1 text-sm text-zinc-400 line-through">{name}</span>
                      <button
                        onClick={() => restoreBuiltin(name)}
                        className="px-3 py-1.5 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 text-xs font-semibold uppercase tracking-wide rounded-lg transition-colors flex-shrink-0"
                      >
                        Restaurar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal de confirmação */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-[#1a1a1a] border border-zinc-700 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-heading font-black text-xl uppercase text-white mb-2">Excluir exercício</h3>
            <p className="text-zinc-200 text-sm font-semibold mb-1">"{confirmDelete.name}"</p>
            <p className="text-zinc-400 text-sm mb-6">
              {confirmDelete.type === 'builtin'
                ? 'O exercício deixará de aparecer para os usuários. Você poderá restaurá-lo depois.'
                : 'O exercício será removido permanentemente da base.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-semibold uppercase tracking-wide text-xs rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmedDelete}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-heading font-bold uppercase tracking-widest text-sm rounded-xl transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ExerciseRow({ name, badge, isEditing, editName, onEditChange, onEditStart, onEditSave, onEditCancel, onDelete }) {
  return (
    <div className="px-5 py-3 flex items-center gap-3">
      {isEditing ? (
        <>
          <input
            type="text"
            value={editName}
            onChange={e => onEditChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onEditSave()
              if (e.key === 'Escape') onEditCancel()
            }}
            autoFocus
            className="flex-1"
          />
          <button onClick={onEditSave}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wide rounded-lg transition-colors flex-shrink-0">
            Salvar
          </button>
          <button onClick={onEditCancel}
            className="px-3 py-1.5 border border-zinc-700 hover:border-zinc-500 text-zinc-400 text-xs font-semibold uppercase tracking-wide rounded-lg transition-colors flex-shrink-0">
            Cancelar
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm text-zinc-200 flex items-center gap-2">
            {name}
            {badge && (
              <span className="text-[9px] text-zinc-600 uppercase tracking-widest border border-zinc-800 rounded px-1.5 py-0.5">{badge}</span>
            )}
          </span>
          <button onClick={onEditStart}
            className="px-3 py-1.5 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 text-xs font-semibold uppercase tracking-wide rounded-lg transition-colors flex-shrink-0">
            Editar
          </button>
          <button onClick={onDelete}
            className="px-3 py-1.5 border border-red-900 hover:border-red-600 text-red-500 hover:text-red-400 text-xs font-semibold uppercase tracking-wide rounded-lg transition-colors flex-shrink-0">
            Excluir
          </button>
        </>
      )}
    </div>
  )
}
