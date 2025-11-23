import type { UserProfile } from "@/lib/serverApi";

type RangeKey = "1m" | "3m" | "6m" | "ytd" | "all";
type Granularity = "day" | "week" | "month" | "quarter";
type Currency = "PLN" | "EUR" | "USD";

type ProfileClientProps = {
  initialProfile: UserProfile;
};

export function ProfileClient() {
    const [name, setName] = useState(initialProfile.name);
    const [email, setEmail] = useState(initialProfile.email);

    const [currency, setCurrency] = useState<Currency>(
    (initialProfile.currency as Currency) ?? "PLN"
    );
    const [defaultRange, setDefaultRange] = useState<RangeKey>(
    (initialProfile.default_range as RangeKey) ?? "3m"
    );
    const [defaultGranularity, setDefaultGranularity] =
    useState<Granularity>(
        (initialProfile.default_granularity as Granularity) ?? "month"
    );

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const avatarInitials =
    name && name.trim().length > 0
      ? name
          .trim()
          .split(" ")
          .map((p) => p[0]?.toUpperCase())
          .slice(0, 2)
          .join("")
      : "U";

const handleSave = async () => {
  try {
    setSaving(true);

    const payload = {
      name,
      email,
      currency,
      default_range: defaultRange,
      default_granularity: defaultGranularity,
      theme: "dark",
    };

    const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

    const res = await fetch(`${API_BASE}/user/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    });


    if (!res.ok) {
      console.error("Failed to update profile", await res.text());
      // tu możesz kiedyś dodać toast z błędem
      return;
    }

    const updated = await res.json();
    setSavedAt(new Date());
  } finally {
    setSaving(false);
  }
};


  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-slate-400">
          Dane użytkownika i preferencje aplikacji.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)]">
        {/* lewa kolumna: user info + accounts */}
        <div className="space-y-4">
          {/* user info */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-indigo-500/30 border border-indigo-400/60 flex items-center justify-center text-sm font-semibold text-indigo-50">
                {avatarInitials}
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-400">
                  Local user profile
                </span>
                <span className="text-sm font-medium text-slate-100">
                  {name}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Imię / nick</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 focus:ring-0"
                  placeholder="Twoje imię"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 focus:ring-0"
                  placeholder="you@example.com"
                />
              </div>
            </div>
          </section>

          {/* accounts link */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-200">
                Accounts
              </h2>
              <span className="text-[11px] text-slate-500">
                Konta i importy
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Zarządzaj kontami bankowymi, podglądaj historię importów
              wyciągów i ich statusy.
            </p>
            <div>
              <Link
                href="/profile/accounts"
                className="inline-flex items-center gap-1 rounded-full border border-indigo-400/60 bg-indigo-500/10 px-3 py-1.5 text-[11px] font-medium text-indigo-200 hover:bg-indigo-500/20 transition-colors"
              >
                Otwórz Accounts →
              </Link>
            </div>
          </section>
        </div>

        {/* prawa kolumna: preferencje + przycisk zapisu */}
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-slate-200">
                Preferencje
              </h2>
              {savedAt && (
                <span className="text-[11px] text-emerald-300">
                  Zapisano:{" "}
                  {savedAt.toLocaleTimeString("pl-PL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2 text-sm">
              {/* waluta */}
              <div className="space-y-1">
                <label className="text-xs text-slate-400">
                  Domyślna waluta
                </label>
                <select
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 focus:ring-0"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                >
                  <option value="PLN">PLN – złoty polski</option>
                  <option value="EUR">EUR – euro</option>
                  <option value="USD">USD – dolar amerykański</option>
                </select>
              </div>

              {/* domyślny zakres na dashboardzie */}
              <div className="space-y-1">
                <label className="text-xs text-slate-400">
                  Domyślny zakres na Dashboardzie
                </label>
                <select
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 focus:ring-0"
                  value={defaultRange}
                  onChange={(e) =>
                    setDefaultRange(e.target.value as RangeKey)
                  }
                >
                  <option value="1m">Ostatni miesiąc</option>
                  <option value="3m">Ostatnie 3 miesiące</option>
                  <option value="6m">Ostatnie 6 miesięcy</option>
                  <option value="ytd">Year to date</option>
                  <option value="all">Cała historia</option>
                </select>
              </div>

              {/* domyślna granulacja wykresu */}
              <div className="space-y-1">
                <label className="text-xs text-slate-400">
                  Domyślna granulacja wykresów
                </label>
                <select
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 focus:ring-0"
                  value={defaultGranularity}
                  onChange={(e) =>
                    setDefaultGranularity(e.target.value as Granularity)
                  }
                >
                  <option value="day">Dziennie</option>
                  <option value="week">Tygodniowo</option>
                  <option value="month">Miesięcznie</option>
                  <option value="quarter">Kwartalnie</option>
                </select>
              </div>

              {/* tryb UI – na razie tylko dark */}
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Tryb UI</label>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    className="flex-1 rounded-lg border border-indigo-400/60 bg-indigo-500/20 px-3 py-2 text-indigo-100 cursor-default"
                  >
                    Dark (aktywny)
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-slate-500 cursor-not-allowed"
                  >
                    Light (w przygotowaniu)
                  </button>
                </div>
              </div>
            </div>

            {/* przycisk zapisu */}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[11px] text-slate-500">
                Na razie preferencje zapisywane są lokalnie w sesji demo.
              </p>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={[
                  "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium",
                  saving
                    ? "bg-slate-700 text-slate-300"
                    : "bg-emerald-500 text-slate-950 hover:bg-emerald-400",
                ].join(" ")}
              >
                {saving ? "Zapisywanie..." : "Zapisz zmiany"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
