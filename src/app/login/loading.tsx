export default function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-(--bg-base) p-6">
      <div className="w-full max-w-md space-y-6 page-enter">
        <div className="mx-auto route-loading-skeleton h-14 w-14 rounded-2xl" />
        <div className="mx-auto route-loading-skeleton h-6 w-40 rounded-lg" />
        <div className="glass-card route-loading-skeleton h-72 border-0!" />
      </div>
    </div>
  );
}
