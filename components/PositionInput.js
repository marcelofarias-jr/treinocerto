import { useState, useEffect } from 'react'

/*
 * Input numérico para definir a posição de um item na sequência. Mantém um
 * rascunho local enquanto o usuário digita (permitindo números de 2+ dígitos)
 * e só confirma a mudança ao sair do campo (blur) ou pressionar Enter.
 */
export default function PositionInput({ value, min = 1, max, onCommit, className = '', title }) {
  const [draft, setDraft] = useState(String(value))

  // Ressincroniza quando a posição muda por outra via (setas, outro input).
  useEffect(() => { setDraft(String(value)) }, [value])

  function commit() {
    const n = parseInt(draft, 10)
    if (Number.isNaN(n)) { setDraft(String(value)); return }
    onCommit(n)
  }

  return (
    <input
      type="number"
      min={min}
      max={max}
      value={draft}
      title={title}
      className={className}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') { commit(); e.currentTarget.blur() }
        if (e.key === 'Escape') { setDraft(String(value)); e.currentTarget.blur() }
      }}
    />
  )
}
