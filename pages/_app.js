import "../styles/globals.css";
import { SessionProvider, useSession } from "next-auth/react";
import Head from "next/head";
import Header from "../components/Header";

function AppContent({ Component, pageProps }) {
  const { data: session } = useSession();

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <title>TreinoCerto</title>
        <meta name="theme-color" content="#0f0f0f" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TreinoCerto" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>
      {session && <Header />}
      {/* pb-28 md:pb-0: espaço para bottom nav + barra de treino ativo no mobile */}
      <div className="pb-28 md:pb-0">
        <Component {...pageProps} />
      </div>
    </>
  );
}

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <AppContent Component={Component} pageProps={pageProps} />
    </SessionProvider>
  );
}
