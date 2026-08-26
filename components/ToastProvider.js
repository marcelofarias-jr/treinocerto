import { createContext, useCallback, useContext, useRef, useState } from 'react'
import Toast from './Toast'

/*
 * Toast disponível em qualquer tela. Antes o componente existia mas só o
 * dashboard usava, então falhas de salvamento nas outras páginas passavam
 * em silêncio.
 *
 *   const toast = useToast()
 *   toast('Treino deletado')
 *   toast(err.message, 'error')
 */
const ToastContext = createContext(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const seq = useRef(0)

  // A key remonta o Toast a cada mensagem nova, reiniciando o timer de 3s —
  // sem ela, uma segunda mensagem herdaria o tempo restante da primeira.
  const show = useCallback((message, type = 'success') => {
    if (!message) return
    seq.current += 1
    setToast({ message, type, key: seq.current })
  }, [])

  const close = useCallback(() => setToast(null), [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onClose={close} />}
    </ToastContext.Provider>
  )
}
