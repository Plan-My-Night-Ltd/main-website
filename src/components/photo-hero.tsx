import Image from "next/image";
import type { ReactNode } from "react";
import type { Photo } from "@/lib/photos";

// Full-bleed photograph with content set over its lower edge, and the photo credit beneath it.
export function PhotoHero({
  photo,
  children,
  height = "tall",
  showCredit = true,
}: {
  photo?: Photo;
  children: ReactNode;
  height?: "tall" | "short";
  showCredit?: boolean;
}) {
  return (
    <>
      <section
        className={`relative isolate flex items-end overflow-hidden bg-raised ${
          height === "tall" ? "h-[min(72svh,44rem)] min-h-[26rem]" : "h-[min(46svh,30rem)] min-h-[20rem]"
        }`}
      >
        {photo && <Image src={photo.src} alt="" fill priority sizes="100vw" className="photo -z-10 object-cover" />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/50 to-black/20" />
        <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-8 sm:pb-16">{children}</div>
      </section>
      {photo && showCredit && (
        <p className="mx-auto max-w-7xl px-4 pt-2 text-right text-[0.6875rem] text-ash sm:px-8">
          Photo:{" "}
          <a href={photo.credit.source} target="_blank" rel="noopener noreferrer" className="hover:text-white">
            {photo.credit.artist}, {photo.credit.license}
          </a>
        </p>
      )}
    </>
  );
}
