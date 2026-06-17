import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";

const NAV = [
  {
    href: "/",
    label: "Início",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/dashboard",
    label: "Montar",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    href: "/my-workouts",
    label: "Treinos",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href: "/treino",
    label: "Treinar",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    href: "/stats",
    label: "Stats",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

export default function Header() {
  const { data: session } = useSession();
  const router = useRouter();

  if (!session) return null;

  // Página de treino ativo: sem header no mobile (tem sua própria navegação)
  const isTrainoAtivo = router.pathname === "/treino";

  return (
    <>
      {/* Top header — hidden on mobile when on treino page */}
      <header
        className={`bg-[#0f0f0f] border-b border-zinc-800 sticky top-0 z-40 ${isTrainoAtivo ? "hidden md:block" : ""}`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 md:gap-3">
            <div className="w-7 h-7 md:w-8 md:h-8 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
              </svg>
            </div>
            <div className="leading-none">
              <p className="font-heading font-black text-white text-base md:text-lg tracking-wide uppercase">TreinoCerto</p>
              <p className="hidden md:block text-zinc-600 text-[9px] uppercase tracking-widest">Workout Tracker</p>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center">
            {NAV.map(({ href, label }) => {
              const active = router.pathname === href;
              return (
                <Link key={href} href={href}
                  className={`px-4 py-5 text-xs font-semibold uppercase tracking-widest border-b-2 transition-colors ${
                    active ? "text-white border-red-500" : "text-zinc-500 border-transparent hover:text-zinc-300"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            <button
              onClick={() => signOut()}
              className="ml-4 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Sair
            </button>
          </nav>

          {/* Mobile: sign out button */}
          <button
            onClick={() => signOut()}
            className="md:hidden text-xs font-semibold uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors px-2 py-2"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Bottom nav — mobile only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0f0f0f] border-t border-zinc-800"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex">
            {NAV.map(({ href, label, icon }) => {
              const active = router.pathname === href;
              return (
                <Link key={href} href={href}
                  className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
                    active ? "text-red-500" : "text-zinc-600 hover:text-zinc-400"
                  }`}
                >
                  {icon}
                  <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
                  {active && <span className="absolute bottom-0 w-8 h-0.5 bg-red-500 rounded-t-full" />}
                </Link>
              );
            })}
          </div>
      </nav>
    </>
  );
}
