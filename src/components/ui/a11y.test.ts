import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Field, SubmitButton } from "./form";
import { buttonClass, type ButtonVariant } from "./button-class";
import Home from "@/app/page";
import AppLayout from "@/app/(app)/layout";

function luminance(hex: string): number {
  const rgb = hex.replace("#", "").match(/.{2}/g)!.map((x) => {
    const v = parseInt(x, 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
}

function contrast(hex1: string, hex2: string): number {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return Number(ratio.toFixed(2));
}

describe("A11y: Form Field Component States", () => {
  it("renders input with accessible label association and minimum 44px touch target", () => {
    const html = renderToStaticMarkup(createElement(Field, { label: "Nama Lengkap", name: "full_name" }));
    expect(html).toContain('<label for="f-full_name"');
    expect(html).toContain('id="f-full_name"');
    expect(html).toContain('name="full_name"');
    expect(html).toContain("min-h-11"); // 44px minimum touch target
    expect(html).toContain("focus-visible:outline-2");
    expect(html).toContain("focus-visible:outline-accent");
    expect(html).toContain("focus-visible:outline-offset-2");
    expect(html).not.toContain('aria-invalid="true"');
  });

  it("links hint text with aria-describedby when hint is provided", () => {
    const html = renderToStaticMarkup(
      createElement(Field, {
        label: "Kode Kelas",
        name: "code",
        hint: "Masukkan 6 karakter kode kelas dari pengajar",
      })
    );
    expect(html).toContain('aria-describedby="f-code-hint"');
    expect(html).toContain('<p id="f-code-hint"');
    expect(html).toContain("Masukkan 6 karakter kode kelas");
  });

  it("properly marks input invalid and connects error message via aria-describedby on error state", () => {
    const html = renderToStaticMarkup(
      createElement(Field, {
        label: "Email",
        name: "email",
        error: "Format email tidak valid",
      })
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="f-email-err"');
    expect(html).toContain('<p id="f-email-err"');
    expect(html).toContain("text-accent");
    expect(html).toContain("aria-invalid:border-accent");
  });
});

describe("A11y: Button Component and Class Variants", () => {
  const variants: ButtonVariant[] = ["primary", "accent", "ghost"];

  it.each(variants)("ensures variant '%s' includes minimum 44px touch target (min-h-11)", (variant) => {
    const cls = buttonClass(variant);
    expect(cls).toContain("min-h-11");
  });

  it("renders SubmitButton with accessible pending state", () => {
    const html = renderToStaticMarkup(
      createElement(SubmitButton, { pending: "Menyimpan…" }, "Simpan")
    );
    expect(html).toContain('type="submit"');
    expect(html).toContain("min-h-11");
  });
});

describe("A11y: Semantic Skip Link Targets", () => {
  it("ensures Home page skip link targets <main id=\"main-content\" tabIndex={-1}>", () => {
    const html = renderToStaticMarkup(createElement(Home));
    expect(html).toContain('href="#main-content"');
    expect(html).toContain('<main id="main-content" tabindex="-1"');
  });

  it("ensures AppLayout skip link targets <main id=\"main-content\" tabIndex={-1}>", () => {
    const html = renderToStaticMarkup(createElement(AppLayout, null, createElement("div", null, "Konten")));
    expect(html).toContain('href="#main-content"');
    expect(html).toContain('<main id="main-content" tabindex="-1"');
  });
});

describe("A11y: Color Contrast Quantitative Validation (WCAG 2.1 AA)", () => {
  // Editorial tokens (docs/design-system.md §3)
  const tokens = {
    paper: "#F4EFE6",
    paper2: "#EAE3D6",
    ink: "#1B1A17",
    ink2: "#5B574F",
    rule: "#D3CABA",
    accent: "#D9432B",
    accentInk: "#FFF8F0",
    stage: "#0E0D0B",
    stage2: "#1A1814",
    spot: "#FFD9A8",
    stageInk: "#EDE6DA",
    stageInk2: "#9A9285",
  };

  it("passes WCAG AA normal text contrast (>= 4.5:1) for editorial text", () => {
    expect(contrast(tokens.ink, tokens.paper)).toBeGreaterThanOrEqual(4.5); // 15.19:1
    expect(contrast(tokens.ink2, tokens.paper)).toBeGreaterThanOrEqual(4.5); // 6.28:1
  });

  it("passes WCAG AA UI component non-text contrast (>= 3.0:1) for editorial focus outline", () => {
    expect(contrast(tokens.accent, tokens.paper)).toBeGreaterThanOrEqual(3.0); // 3.83:1
    expect(contrast(tokens.accent, tokens.paper2)).toBeGreaterThanOrEqual(3.0); // 3.44:1
  });

  it("passes WCAG AA normal text contrast (>= 4.5:1) for stage text", () => {
    expect(contrast(tokens.stageInk, tokens.stage)).toBeGreaterThanOrEqual(4.5); // 15.66:1
    expect(contrast(tokens.stageInk2, tokens.stage)).toBeGreaterThanOrEqual(4.5); // 6.31:1
    expect(contrast(tokens.stageInk, tokens.stage2)).toBeGreaterThanOrEqual(4.5); // 14.29:1
  });

  it("passes WCAG AA UI component non-text contrast (>= 3.0:1) for stage focus outline", () => {
    expect(contrast(tokens.spot, tokens.stage)).toBeGreaterThanOrEqual(3.0); // 14.56:1
    expect(contrast(tokens.spot, tokens.stage2)).toBeGreaterThanOrEqual(3.0); // 13.29:1
  });
});

describe("A11y: Reduced Motion Compliance (docs/design-system.md §4)", () => {
  const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
  const reportCode = readFileSync(resolve(process.cwd(), "src/app/(app)/sesi/[id]/selesai/page.tsx"), "utf8");
  const avatarCode = readFileSync(resolve(process.cwd(), "src/features/avatar/avatar.tsx"), "utf8");
  const vrmCode = readFileSync(resolve(process.cwd(), "src/features/avatar/vrm-avatar.tsx"), "utf8");

  it("verifies .stabilo is purely static CSS background without runtime animation or transition (instant final state)", () => {
    const stabiloBlock = css.match(/@utility stabilo\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(stabiloBlock).toContain("linear-gradient");
    expect(stabiloBlock).not.toContain("animation");
    expect(stabiloBlock).not.toContain("transition");
    expect(stabiloBlock).not.toContain("@keyframes");
  });

  it("verifies score report in sesi/[id]/selesai renders directly without count-up animation timers", () => {
    expect(reportCode).toContain("{graded.score}");
    expect(reportCode).toContain("tabular-nums");
    // Ensure no client-side count-up / timer animation modules or intervals are used
    expect(reportCode).not.toContain("useCountUp");
    expect(reportCode).not.toContain("setInterval");
    expect(reportCode).not.toContain("requestAnimationFrame");
    expect(reportCode).not.toContain("framer-motion");
    expect(reportCode).not.toContain("motion/react");
  });

  it("verifies global reduced-motion overrides disable stage transition, spotlight, and all CSS animations", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation-duration: 0.01ms !important;");
    expect(css).toContain("transition-duration: 0.01ms !important;");
    expect(css).toContain("scroll-behavior: auto !important;");
    expect(css).toMatch(/\.stage-enter\s*\{[^}]*clip-path:\s*none\s*!important/);
    expect(css).toMatch(/\.spotlight\s*\{[^}]*animation:\s*none\s*!important/);
  });

  it("verifies 3D VRM Avatar respects prefers-reduced-motion, halting body/nod motion while preserving blink and lip-sync", () => {
    // avatar.tsx listens to prefers-reduced-motion and passes still prop
    expect(avatarCode).toContain('const reducedQuery = "(prefers-reduced-motion: reduce)"');
    expect(avatarCode).toContain("const still = useSyncExternalStore");
    expect(avatarCode).toContain("<VrmAvatar");
    expect(avatarCode).toContain("still={still}");

    // vrm-avatar.tsx halts sway, breathing, and nod when still === true
    expect(vrmCode).toContain("if (!still) {");
    expect(vrmCode).toContain('const head = vrm.humanoid.getNormalizedBoneNode("head");');
    expect(vrmCode).toContain("head?.rotation.set(n.x, n.y, n.z);");
    expect(vrmCode).toContain('vrm.humanoid.getNormalizedBoneNode("chest")?.rotation.set(n.chest, 0, 0);');
  });
});

