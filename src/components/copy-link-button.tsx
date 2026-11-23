"use client";

import { useState } from "react";
import { button } from "@/components/ui";

/** Shares `path` (the signed share link, so the friend opening it doesn't need an account). */
export function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = new URL(path, window.location.origin).href;
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ title: "Our night out", url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" onClick={copy} className={button.light}>
      <span aria-live="polite">{copied ? "Link copied" : "Share this plan"}</span>
    </button>
  );
}
