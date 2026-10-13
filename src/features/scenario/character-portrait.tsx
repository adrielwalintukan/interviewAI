// Placeholder portrait until the VRM assets land (M3): an arched "doorway" in the character's
// hue with a serif initial. Duotone ink-on-paper, per design-system §9.
export function CharacterPortrait({
  name,
  hue,
  size = "md",
}: {
  name: string;
  hue: number;
  size?: "sm" | "md" | "lg";
}) {
  const initial = name.replace(/^(Bu|Pak|Kak|Mas|Mbak)\s+/i, "").charAt(0).toUpperCase();
  const dims = { sm: "h-14 w-11 text-2xl", md: "h-24 w-[4.5rem] text-4xl", lg: "h-36 w-28 text-6xl" }[size];
  return (
    <span
      aria-hidden
      className={`relative inline-flex shrink-0 items-end justify-center overflow-hidden rounded-t-full border border-ink/15 font-display ${dims}`}
      style={{
        background: `linear-gradient(170deg, oklch(0.93 0.04 ${hue}) 0%, oklch(0.78 0.09 ${hue}) 100%)`,
        color: `oklch(0.3 0.06 ${hue})`,
      }}
    >
      <span
        className="absolute bottom-0 left-1/2 h-1/2 w-[85%] -translate-x-1/2 rounded-t-full"
        style={{ background: `oklch(0.62 0.1 ${hue} / 0.55)` }}
      />
      <span className="relative mb-[12%] leading-none">{initial}</span>
    </span>
  );
}
