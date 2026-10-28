"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { HolidayPicker } from "@/components/HolidayProvider";
import { MemberSelect, useMember } from "@/components/MemberProvider";

const LINKS = [
  { href: "/me", label: "Preferences" },
  { href: "/settings", label: "Settings" },
  { href: "/plan", label: "Plan" },
  { href: "/vote", label: "Vote" },
  { href: "/result", label: "Result" },
] as const;

export function Nav() {
  const pathname = usePathname();
  const { member } = useMember();
  return (
    <header className="sticky top-0 z-30 border-b-2 border-[var(--ink)] bg-[color-mix(in_srgb,var(--card)_88%,transparent)] backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href="/" className="group flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" className="logo-mark size-9 shrink-0" fill="none" aria-hidden="true">
            <rect x="2" y="5" width="28" height="25" rx="7" fill="#FFD23F" stroke="#14103A" strokeWidth="2.5" />
            <path d="M2 13h28" stroke="#14103A" strokeWidth="2.5" />
            <path d="M10 2v6M22 2v6" stroke="#14103A" strokeWidth="2.5" strokeLinecap="round" />
            <path d="m10 21 4 4 8-9" stroke="#FF5A5F" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="display text-xl font-extrabold tracking-tight">
            Save<span className="gradient-text">the</span>Date
          </span>
        </Link>
        <nav aria-label="Main" className="order-3 w-full sm:order-none sm:w-auto">
          <ul className="flex flex-wrap gap-1.5">
            {LINKS.map((l) => {
              const active = pathname === l.href;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-full border-2 px-3.5 py-1 text-sm font-extrabold transition-transform hover:-translate-y-0.5 hover:rotate-1 ${
                      active
                        ? "sticker border-[var(--ink)] bg-[var(--sun)] text-[#14103a]"
                        : "border-transparent hover:border-[var(--ink)]"
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
          <HolidayPicker />
          <div className="flex items-center gap-2.5">
            {member && <Avatar id={member.id} name={member.name} size={34} ring />}
            <MemberSelect id="nav-member" />
          </div>
        </div>
      </div>
    </header>
  );
}
