// Placeholder shapes while a Control Center section loads, so a click always shows something at once.
export function TabSkeleton() {
  const block = "border border-line bg-raised motion-safe:animate-pulse";
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`${block} h-28`} />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className={`${block} h-56`} />
        <div className={`${block} h-56`} />
      </div>
      <div className={`${block} h-72`} />
    </div>
  );
}

/** The whole page while the first load comes in: header, tab row and a section. */
export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 pb-24 sm:px-8 sm:pt-14">
      <p className="text-sm tracking-[0.2em] text-ash uppercase">Admin</p>
      <p className="mt-1 text-title font-light">Control Center</p>
      <p className="mt-2 text-sm text-ash">Loading…</p>
      <div className="mt-8 h-12 border-b border-line" />
      <div className="mt-8">
        <TabSkeleton />
      </div>
    </div>
  );
}
