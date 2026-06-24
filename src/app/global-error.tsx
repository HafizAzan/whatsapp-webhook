"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[#050508] p-6 text-[#f4f4f5]">
        <div className="max-w-md text-center">
          <h1 className="mb-2 text-xl font-semibold">Something went wrong</h1>
          <p className="mb-6 text-sm text-[#a1a1aa]">{error.message}</p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-400"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
