import { SignUpForm } from "@/features/auth/components";

export const metadata = { title: "Daftar — Interview AI" };

export default function DaftarPage() {
  return (
    <>
      <p className="font-mono text-label uppercase text-accent">Daftar</p>
      <h1 className="mt-3 font-display text-display font-medium tracking-tight">Mulai berlatih menggali.</h1>
      <SignUpForm />
    </>
  );
}
