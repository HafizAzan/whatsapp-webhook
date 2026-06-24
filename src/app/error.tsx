"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
      <h2 className="mb-2 text-lg font-semibold text-(--text)">Page error</h2>
      <p className="mb-6 max-w-md text-sm text-(--text-muted)">{error.message}</p>
      <button type="button" onClick={() => reset()} className="btn-primary">
        Try again
      </button>
    </div>
  );
}
