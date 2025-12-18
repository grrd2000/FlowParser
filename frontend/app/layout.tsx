import "./globals.css";
import type { ReactNode } from "react";
import { TopNav } from "@/components/TopNav";
import { AuthProvider } from "@/components/AuthProvider";
import { AppShell } from "@/components/AppShell";

export const metadata = {
  title: "FlowParser",
  description: "Personal finance insights with modern UI",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <TopNav />
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
