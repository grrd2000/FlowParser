// frontend/app/profile/page.tsx
import Link from "next/link";

export default function ProfilePage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-slate-400">
          Ustawienia użytkownika i preferencje aplikacji.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
          <h2 className="text-sm font-medium mb-2 text-slate-200">
            Dane użytkownika
          </h2>
          <ul className="text-sm text-slate-300 space-y-1">
            <li>
              <span className="text-slate-400">Email:</span>{" "}
              demo@example.com
            </li>
            <li>
              <span className="text-slate-400">Imię:</span> Gerard
            </li>
          </ul>
        </section>

        <section className="border border-slate-800 rounded-xl p-4 bg-slate-900/40 space-y-2">
          <h2 className="text-sm font-medium mb-2 text-slate-200">
            Accounts
          </h2>
          <p className="text-sm text-slate-400">
            Zarządzaj kontami bankowymi i historią importów.
          </p>
          <Link
            href="/profile/accounts"
            className="inline-flex items-center gap-2 text-xs font-medium text-emerald-400 hover:text-emerald-300"
          >
            Otwórz Accounts →
          </Link>
        </section>
      </div>
    </div>
  );
}
