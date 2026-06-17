import "../styles/globals.css";
import { SessionProvider, useSession } from "next-auth/react";
import Head from "next/head";
import Header from "../components/Header";

function AppContent({ Component, pageProps }) {
  const { data: session } = useSession();

  return (
    <>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>
      {session && <Header />}
      <Component {...pageProps} />
    </>
  );
}

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}) {
  return (
    <SessionProvider session={session}>
      <AppContent Component={Component} pageProps={pageProps} />
    </SessionProvider>
  );
}
