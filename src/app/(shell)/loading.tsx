export default function ShellLoading() {
  return (
    <div className="page-enter space-y-5" aria-busy="true" aria-label="Loading page">
      <div className="route-loading-skeleton h-8 w-48" />
      <div className="route-loading-skeleton h-4 w-72 max-w-full" />
      <div className="glass-card route-loading-skeleton h-64 border-0!" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="route-loading-skeleton h-28 rounded-2xl" />
        <div className="route-loading-skeleton h-28 rounded-2xl" />
      </div>
    </div>
  );
}
