import { SignUpForm } from "@/features/auth/components";

export const metadata = { title: "Daftar — Interview AI" };

export default function DaftarPage() {
  return (
    <>
      <h1 className="font-display text-display font-medium tracking-tight">Buat akun</h1>
      <SignUpForm />
    </>
  );
}
