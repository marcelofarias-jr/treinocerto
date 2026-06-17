import { useState } from 'react'

const exercises = [
  'Agachamento',
  'Levantamento Terra',
  'Supino Reto',
  'Remada Curvada',
  'Desenvolvimento Ombro',
  'Rosca Direta',
  'Tríceps Pulley'
]

export default function ExerciseSelector({ value = [], onChange }) {
  const [selected, setSelected] = useState(value)

  function toggle(ex) {
    const next = selected.includes(ex) ? selected.filter(s => s!==ex) : [...selected, ex]
    setSelected(next)
    onChange(next)
  }

  return (
    <div className="mt-4">
      <label className="block font-medium mb-2">Exercícios</label>
      <div className="grid grid-cols-2 gap-2">
        {exercises.map(ex => (
          <button key={ex} onClick={() => toggle(ex)} className={`px-3 py-2 rounded border text-left ${selected.includes(ex)? 'bg-green-600 text-white':'bg-white'}`}>
            {ex}
          </button>
        ))}
      </div>
    </div>
  )
}
