import { Suspense } from "react";
import { SignInForm } from "@/features/auth/components";

export const metadata = { title: "Masuk — Interview AI" };

async function Form({ searchParams }: { searchParams: PageProps<"/masuk">["searchParams"] }) {
  const sp = await searchParams;
  const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  return <SignInForm next={pick(sp.next)} error={pick(sp.error)} />;
}

export default function MasukPage({ searchParams }: PageProps<"/masuk">) {
  return (
    <>
      <p className="font-mono text-label uppercase text-accent">Masuk</p>
      <h1 className="mt-3 font-display text-display font-medium tracking-tight">Selamat datang kembali.</h1>
      <Suspense>
        <Form searchParams={searchParams} />
      </Suspense>
    </>
  );
}
