import { useEffect, useState } from "react";

type HealthState = "loading" | "ok" | "error";

export default function App() {
  const [health, setHealth] = useState<HealthState>("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((r) => r.json() as Promise<{ status: string }>)
      .then((d) => {
        if (!cancelled) setHealth(d.status === "ok" ? "ok" : "error");
      })
      .catch(() => {
        if (!cancelled) setHealth("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center bg-neutral-950 text-neutral-100">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">eyday-paper</h1>
        <p className="text-sm text-neutral-400">論文を読むハードルを下げる</p>
        <p className="text-xs text-neutral-500">
          API:{" "}
          <span
            className={
              health === "ok"
                ? "text-emerald-400"
                : health === "error"
                  ? "text-rose-400"
                  : "text-neutral-400"
            }
          >
            {health}
          </span>
        </p>
      </div>
    </main>
  );
}
