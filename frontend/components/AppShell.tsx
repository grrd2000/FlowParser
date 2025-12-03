// components/AppShell.tsx
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {/* animowane „orbits” w tle */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="bg-orbit bg-orbit--left" />
        <div className="bg-orbit bg-orbit--right" />
      </div>

      {/* właściwa treść stron */}
      <div className="relative">
        {children}
      </div>
    </div>
  );
}
