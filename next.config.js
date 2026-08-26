/*
 * Content-Security-Policy em modo Report-Only de propósito.
 *
 * Assim o navegador registra violações no console sem quebrar nada — dá para
 * navegar o app, ver se algo é bloqueado e só então promover para
 * `Content-Security-Policy` (trocar a chave abaixo). Ligar de primeira arrisca
 * derrubar o login do Google ou as fontes em produção.
 */
const csp = [
  "default-src 'self'",
  // Next injeta scripts inline (hidratação); 'unsafe-eval' é necessário em dev.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Tailwind/Next injetam estilos inline; as fontes vêm do Google.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  // data: cobre os SVGs inline; googleusercontent, a foto de perfil do Google.
  "img-src 'self' data: https://lh3.googleusercontent.com",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "object-src 'none'",
].join('; ')

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Sem `preload`: entrar na lista de preload dos navegadores é difícil de desfazer.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Content-Security-Policy-Report-Only', value: csp },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

module.exports = nextConfig
