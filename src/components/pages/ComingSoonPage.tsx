interface ComingSoonPageProps {
  title: string;
  description: string;
}

export function ComingSoonPage({ title, description }: ComingSoonPageProps) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center">
      <div className="glass-card max-w-sm p-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-(--accent-dim) text-2xl text-(--accent-bright)">
          ◇
        </div>
        <p className="font-semibold text-(--text)">{title}</p>
        <p className="mt-2 text-sm text-(--text-dim)">{description}</p>
      </div>
    </div>
  );
}
