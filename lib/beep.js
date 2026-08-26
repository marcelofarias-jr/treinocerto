/*
 * Alarme do timer de descanso.
 *
 * Um único AudioContext reaproveitado. Antes cada beep criava um contexto novo
 * e nunca o fechava: navegadores limitam contextos simultâneos por documento
 * (Chrome, historicamente ~6), então num treino de 20+ séries os beeps
 * simplesmente paravam de sair — em silêncio, porque o erro era engolido.
 */
let ctx = null

function getCtx() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext
    if (!Ctor) return null
    try { ctx = new Ctor() } catch (_) { return null }
  }
  return ctx
}

/*
 * Cria o contexto durante um gesto do usuário (o toque que conclui a série).
 * Contexto criado fora de gesto nasce suspenso no Chrome, e aí o primeiro
 * beep do treino não toca.
 */
export function primeAudio() {
  const c = getCtx()
  if (c && c.state === 'suspended') c.resume().catch(() => {})
}

export function playBeep() {
  const c = getCtx()
  if (!c) return
  try {
    if (c.state === 'suspended') c.resume().catch(() => {})
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain)
    gain.connect(c.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.3, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.6)
    osc.start(c.currentTime)
    osc.stop(c.currentTime + 0.6)
    // Solta os nós ao terminar; sem isso eles ficam pendurados no contexto.
    osc.onended = () => { try { osc.disconnect(); gain.disconnect() } catch (_) {} }
  } catch (_) {}
}

export function vibrate(pattern = [300, 100, 300, 100, 500]) {
  try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern) } catch (_) {}
}
