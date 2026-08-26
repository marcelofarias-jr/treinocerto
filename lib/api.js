/*
 * Cliente das rotas internas.
 *
 * O padrão anterior era `await fetch(...)` sem olhar a resposta: quando o
 * Supabase falhava, a tela mostrava o sucesso otimista e o dado simplesmente
 * não existia. Aqui todo erro vira exceção com mensagem pronta para o usuário.
 *
 *   await apiFetch('/api/workouts', { method: 'DELETE', json: { id } })
 */
export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function messageFor(status, data) {
  if (data?.error && status >= 400 && status < 500) return data.error
  if (status === 401) return 'Sua sessão expirou. Entre de novo para continuar.'
  if (status === 403) return 'Você não tem acesso a isso.'
  if (status === 404) return 'Registro não encontrado.'
  if (status >= 500) return 'O servidor não conseguiu salvar. Tente de novo em instantes.'
  return 'Não foi possível completar a ação.'
}

export async function apiFetch(url, options = {}) {
  const { json, ...init } = options

  if (json !== undefined) {
    init.method = init.method || 'POST'
    init.headers = { 'Content-Type': 'application/json', ...(init.headers || {}) }
    init.body = JSON.stringify(json)
  }

  let res
  try {
    res = await fetch(url, init)
  } catch (_) {
    // Falha de rede: comum na academia, onde o sinal cai.
    throw new ApiError('Sem conexão. Verifique a internet e tente de novo.', 0)
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(messageFor(res.status, data), res.status)
  return data
}
