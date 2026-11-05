import Link from "next/link";
import { button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-24 sm:px-8">
      <h1 className="text-title font-light">This page doesn&apos;t exist.</h1>
      <p className="mt-4 text-ash">
        If someone shared a plan link with you, it may have been cut off. Ask them to send it again, or plan your own
        night.
      </p>
      <Link href="/plan" className={`${button.light} mt-10`}>
        Plan my night
      </Link>
    </div>
  );
}
