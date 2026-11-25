import { TabSkeleton } from "@/components/control-center/skeleton";

// Shown the instant a person is clicked, while their history loads.
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 pb-24 sm:px-8 sm:pt-14">
      <p className="text-sm text-ash">← Everyone</p>
      <div className="mt-3 h-12 w-72 rounded bg-white/10 motion-safe:animate-pulse" />
      <div className="mt-8">
        <TabSkeleton />
      </div>
    </div>
  );
}
