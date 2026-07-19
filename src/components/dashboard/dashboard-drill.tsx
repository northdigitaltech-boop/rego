"use client";

import * as React from "react";
import { ChevronLeft } from "lucide-react";

/**
 * Mobile drill-down for dashboard sidebars.
 *
 * On small screens (< lg) the sidebar acts as a full-screen menu. Tapping any
 * nav item reveals that section full-screen with a "Menu" back button at the
 * top. On desktop nothing changes — every show/hide rule is scoped to
 * `@media (max-width: 1023px)` in globals.css (see `.rego-dash`).
 *
 * Usage inside a dashboard:
 *   const drill = useDashboardDrill();
 *   ...
 *   <div className="... grid ... lg:grid-cols-[240px_1fr] rego-dash" {...drill.gridProps}>
 *     <DashboardBack onClick={drill.back} />
 *     <aside> ...nav buttons... </aside>
 *     <div> ...content... </div>
 *   </div>
 *
 * The grid's single onClick uses event delegation: any button/link tapped
 * inside the <aside> drills into the content view — so individual nav buttons
 * don't need to be modified.
 */
export function useDashboardDrill() {
  const [view, setView] = React.useState<"menu" | "content">("menu");

  const gridProps = {
    "data-view": view,
    onClick: (e: React.MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("aside") && el.closest("button, a")) setView("content");
    },
  };

  return { view, back: () => setView("menu"), gridProps };
}

export function DashboardBack({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back to menu"
      className="rego-dash-back mb-4 w-fit items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-semibold text-forest shadow-soft"
    >
      <ChevronLeft className="h-4 w-4" />
      Menu
    </button>
  );
}
