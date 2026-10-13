// Plain module (no "use client") so Server Components can style links as buttons too.
const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-5 font-medium transition-[background-color,color,transform] duration-150 ease-out-soft active:translate-y-px disabled:pointer-events-none disabled:opacity-60";

const variants = {
  primary: "bg-ink text-paper hover:bg-accent hover:text-accent-ink",
  accent: "bg-accent text-accent-ink hover:bg-ink hover:text-paper",
  ghost: "border border-rule text-ink hover:border-ink",
} as const;

export type ButtonVariant = keyof typeof variants;

export function buttonClass(variant: ButtonVariant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}
