import GoogleProvider from 'next-auth/providers/google'

// Emails com acesso ao painel de admin (separados por vírgula em ADMIN_EMAILS).
// Sem a variável definida, ninguém é admin — falha fechada de propósito.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

export function isAdminEmail(email) {
  return typeof email === 'string' && ADMIN_EMAILS.includes(email.toLowerCase())
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    // Expõe isAdmin na sessão para a UI decidir o que mostrar, sem precisar
    // do email de admin no bundle do cliente. A permissão de verdade é
    // sempre reconferida no servidor (requireAdmin).
    async session({ session }) {
      if (session?.user) session.user.isAdmin = isAdminEmail(session.user.email)
      return session
    },
  },
}
