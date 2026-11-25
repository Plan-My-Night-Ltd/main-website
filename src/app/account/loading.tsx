// Shown the moment someone opens their account, while their nights load.
export default function AccountLoading() {
  const bar = "rounded-full bg-white/10 motion-safe:animate-pulse";
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 pb-16 sm:px-8 sm:pt-16" aria-busy="true" aria-label="Loading your nights">
      <div className={`h-10 w-64 ${bar}`} />
      <div className={`mt-4 h-4 w-52 ${bar}`} />
      <div className="mt-8 border border-line bg-raised">
        <div className="h-48 bg-white/5 motion-safe:animate-pulse sm:h-60" />
        <div className="space-y-5 px-5 py-7 sm:px-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-4">
              <div className={`h-4 w-14 ${bar}`} />
              <div className="flex-1 space-y-2">
                <div className={`h-3 w-20 ${bar}`} />
                <div className={`h-5 w-44 ${bar}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={`mt-6 h-12 w-full sm:w-40 ${bar}`} />
      <div className={`mt-14 h-12 w-full ${bar}`} />
    </div>
  );
}
