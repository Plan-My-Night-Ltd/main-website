// Shared button looks. Pills with generous padding and a light tracking, nothing louder.
const base =
  "inline-flex items-center justify-center rounded-full px-7 py-3.5 text-[0.9375rem] tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export const button = {
  /** White on black sections. */
  light: `${base} bg-white text-black hover:bg-stone`,
  /** Black on white or bone sections. */
  dark: `${base} bg-black text-white hover:bg-neutral-800`,
  /** Outline on black sections. */
  ghost: `${base} border border-white/35 text-white hover:border-white`,
  /** Outline on white or bone sections. */
  ghostDark: `${base} border border-black/25 text-black hover:border-black`,
};
