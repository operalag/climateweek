export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="panel p-6 text-center">
      <div className="text-base font-medium">{title}</div>
      <div className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>
        {children}
      </div>
    </div>
  );
}
