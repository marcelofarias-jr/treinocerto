import { getServerSession } from 'next-auth/next'
import { authOptions, isAdminEmail } from './auth'

/*
 * Identidade nas rotas de API vem SEMPRE da sessão do servidor.
 *
 * O cliente Supabase usa a service_role key, que ignora RLS — então a rota é
 * a única camada de autorização que existe. Nenhuma rota deve ler email de
 * query string ou corpo da requisição: o cliente escolheria de quem são os
 * dados.
 *
 *   const user = await requireUser(req, res)
 *   if (!user) return            // resposta 401 já enviada
 */
export async function requireUser(req, res) {
  const session = await getServerSession(req, res, authOptions)
  const email = session?.user?.email
  if (!email) {
    res.status(401).json({ error: 'Não autenticado' })
    return null
  }
  return { email, isAdmin: isAdminEmail(email) }
}

// Rotas que alteram dados globais (catálogo de exercícios) exigem admin.
export async function requireAdmin(req, res) {
  const user = await requireUser(req, res)
  if (!user) return null
  if (!user.isAdmin) {
    res.status(403).json({ error: 'Acesso restrito ao administrador' })
    return null
  }
  return user
}
