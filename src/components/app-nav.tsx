"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; match: string[] };

export function AppNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Utama" className="-mx-1 flex gap-1 overflow-x-auto">
      {items.map((item) => {
        const active = item.match.some((m) => path === m || path.startsWith(`${m}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="inline-flex min-h-11 items-center whitespace-nowrap rounded-sm px-3 text-sm text-ink-2 transition-colors hover:text-ink aria-[current=page]:text-ink aria-[current=page]:underline aria-[current=page]:decoration-accent aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8"
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
