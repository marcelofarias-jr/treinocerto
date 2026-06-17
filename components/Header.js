import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";

const NAV = [
  { href: "/", label: "Início" },
  { href: "/dashboard", label: "Montar" },
  { href: "/my-workouts", label: "Treinos" },
  { href: "/treino", label: "Treinar" },
];

export default function Header() {
  const { data: session } = useSession();
  const router = useRouter();

  if (!session) return null;

  return (
    <header className="bg-[#0f0f0f] border-b border-zinc-800 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
            </svg>
          </div>
          <div className="leading-none">
            <p className="font-heading font-black text-white text-lg tracking-wide uppercase">TreinoCerto</p>
            <p className="text-zinc-600 text-[9px] uppercase tracking-widest">Workout Tracker</p>
          </div>
        </Link>

        <nav className="flex items-center">
          {NAV.map(({ href, label }) => {
            const active = router.pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`px-4 py-5 text-xs font-semibold uppercase tracking-widest border-b-2 transition-colors ${
                  active
                    ? "text-white border-red-500"
                    : "text-zinc-500 border-transparent hover:text-zinc-300"
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
      </div>
    </header>
  );
}
