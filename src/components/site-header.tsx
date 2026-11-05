import Link from "next/link";
import { AccountLink } from "@/components/account-link";

export function SiteHeader() {
  return (
    <header className="relative z-20 bg-black">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-4 sm:px-8">
        <nav className="text-sm">
          <Link href="/areas" className="text-white/75 underline-offset-8 hover:text-white hover:underline">
            <span className="sm:hidden">Areas</span>
            <span className="hidden sm:inline">Neighbourhoods</span>
          </Link>
        </nav>
        <Link href="/" className="text-[0.8125rem] font-normal tracking-[0.34em] sm:text-[0.9375rem]">
          PLANMYNIGHTS
        </Link>
        <nav className="flex items-center justify-end gap-6 text-sm">
          <Link
            href="/plan"
            className="hidden text-white/75 underline-offset-8 hover:text-white hover:underline md:inline"
          >
            Plan my night
          </Link>
          <AccountLink />
        </nav>
      </div>
    </header>
  );
}
