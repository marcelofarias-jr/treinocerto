import { useRef, useState, useCallback } from 'react'

/*
 * Lista reordenável por arrasto usando Pointer Events — funciona em
 * touch (mobile) e mouse (desktop). Reordena "ao vivo": conforme o dedo/
 * ponteiro passa pelo ponto médio de outro item, o array é reordenado.
 *
 * Uso:
 *   <SortableList
 *     items={arr}
 *     getKey={(item) => item.name}
 *     onReorder={(from, to) => ...}
 *     renderItem={(item, { index, isDragging, handleProps, setItemRef }) => (
 *       <div ref={setItemRef} className={isDragging ? '...' : ''}>
 *         <span {...handleProps}><GripIcon /></span>
 *         ...
 *       </div>
 *     )}
 *   />
 *
 * O elemento raiz de cada item deve receber `ref={setItemRef}`.
 * A alça de arraste deve espalhar `{...handleProps}`.
 */
export default function SortableList({ items, getKey, onReorder, renderItem, className = '' }) {
  const [dragKey, setDragKey] = useState(null)
  const dragKeyRef = useRef(null)
  const itemRefs = useRef(new Map()) // key -> elemento DOM raiz do item

  const registerRef = useCallback((key, el) => {
    if (el) itemRefs.current.set(key, el)
    else itemRefs.current.delete(key)
  }, [])

  // Índice do item cujo território (até o ponto médio) contém o Y do ponteiro.
  const indexAtY = useCallback((y) => {
    for (let i = 0; i < items.length; i++) {
      const el = itemRefs.current.get(getKey(items[i], i))
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (y < rect.top + rect.height / 2) return i
    }
    return items.length - 1
  }, [items, getKey])

  const startDrag = useCallback((e, key) => {
    // Só arrasto com botão principal / toque; ignora contextual etc.
    if (e.button != null && e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    dragKeyRef.current = key
    setDragKey(key)
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch {}
  }, [])

  const onMove = useCallback((e) => {
    if (dragKeyRef.current == null) return
    e.preventDefault()
    const current = items.findIndex((it, i) => getKey(it, i) === dragKeyRef.current)
    if (current < 0) return
    const target = indexAtY(e.clientY)
    if (target >= 0 && target !== current) onReorder(current, target)
  }, [items, getKey, indexAtY, onReorder])

  const endDrag = useCallback((e) => {
    if (dragKeyRef.current == null) return
    try { e.currentTarget.releasePointerCapture?.(e.pointerId) } catch {}
    dragKeyRef.current = null
    setDragKey(null)
  }, [])

  return (
    <div className={className}>
      {items.map((item, index) => {
        const key = getKey(item, index)
        const isDragging = dragKey === key
        const handleProps = {
          onPointerDown: (e) => startDrag(e, key),
          onPointerMove: onMove,
          onPointerUp: endDrag,
          onPointerCancel: endDrag,
          style: { touchAction: 'none' },
        }
        return (
          <div key={key}>
            {renderItem(item, {
              index,
              isDragging,
              handleProps,
              setItemRef: (el) => registerRef(key, el),
            })}
          </div>
        )
      })}
    </div>
  )
}
