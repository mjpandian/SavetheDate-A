import type { ReactNode } from "react";
import { HolidayProvider } from "@/components/HolidayProvider";
import { MemberProvider } from "@/components/MemberProvider";
import { Nav } from "@/components/Nav";
import { TeamProvider } from "@/components/TeamProvider";
import "./screens.css";
import "./holidays.css";

// Shell for the five screens: holiday theme (colors, floating glyphs, ticker), navigation and
// the shared contexts. The fonts load from Google Fonts with a system fallback, so the app
// still works offline.
export default function ScreensLayout({ children }: { children: ReactNode }) {
  return (
    <HolidayProvider>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Nunito:wght@400;600;700;800&display=swap"
        precedence="default"
      />
      <MemberProvider>
        <TeamProvider>
          <Nav />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        </TeamProvider>
      </MemberProvider>
    </HolidayProvider>
  );
}
