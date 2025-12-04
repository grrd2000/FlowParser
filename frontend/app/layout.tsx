import "./globals.css";
import type { ReactNode } from "react";
import { TopNav } from "@/components/TopNav";

export const metadata = {
  title: "FlowParser",
  description: "Personal finance insights with modern UI",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <TopNav />
        <main className="pt-20 pb-10 px-4 md:px-6">
          <div className="mx-auto w-full max-w-6xl">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
