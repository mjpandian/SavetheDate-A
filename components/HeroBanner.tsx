"use client";

import type { ReactNode } from "react";
import { useHoliday } from "@/components/HolidayProvider";
import { countdownText } from "@/components/holidays";

/**
 * Big animated page header. It picks up the active holiday: a countdown chip, floating holiday
 * emoji, and (unless `highlight` is given) the holiday's word to finish the title. All shapes
 * are decorative.
 */
export function HeroBanner({
  eyebrow,
  title,
  highlight,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  highlight?: string;
  subtitle: string;
  children?: ReactNode;
}) {
  const { holiday, days } = useHoliday();
  const g = holiday.glyphs;
  const countdown = countdownText(holiday, days);
  return (
    <section className="hero pop-in" aria-label={title}>
      <svg className="shape s1" viewBox="0 0 40 40" aria-hidden="true">
        <path d="M20 2c1.5 10 8 16.5 18 18-10 1.5-16.5 8-18 18-1.5-10-8-16.5-18-18 10-1.5 16.5-8 18-18z" fill="currentColor" />
      </svg>
      <svg className="shape s2" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" strokeWidth="6" />
      </svg>
      <svg className="shape s3" viewBox="0 0 60 20" aria-hidden="true">
        <path d="M2 14q7-14 14 0t14 0 14 0 14 0" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <svg className="shape s4" viewBox="0 0 40 40" aria-hidden="true">
        <path d="M20 4 36 34H4z" fill="currentColor" />
      </svg>
      <svg className="shape s5" viewBox="0 0 40 40" aria-hidden="true">
        <path d="M20 2c1.5 10 8 16.5 18 18-10 1.5-16.5 8-18 18-1.5-10-8-16.5-18-18 10-1.5 16.5-8 18-18z" fill="currentColor" />
      </svg>
      {g.length > 0 && (
        <>
          <span className="emoji e1" aria-hidden="true">{g[0]}</span>
          <span className="emoji e2" aria-hidden="true">{g[1 % g.length]}</span>
          <span className="emoji e3" aria-hidden="true">{g[2 % g.length]}</span>
        </>
      )}

      <p className="eyebrow">{eyebrow ?? holiday.eyebrow}</p>
      <h1 className="display hero-title">
        {title} <span className="gradient-text">{highlight ?? holiday.word}</span>
      </h1>
      <p className="hero-sub">{subtitle}</p>
      {countdown && (
        <p className="mt-3 relative z-[1]">
          <span className="holiday-chip">
            <span aria-hidden="true">{g[0]}</span>
            {countdown}
          </span>
        </p>
      )}
      {children && <div className="hero-actions">{children}</div>}
    </section>
  );
}
