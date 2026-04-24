export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="panel p-4">
      <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
        {label}
      </div>
      <div className="mt-1 text-3xl font-semibold">{value}</div>
      {hint ? (
        <div className="mt-1 text-xs" style={{ color: "var(--text-dim)" }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}
