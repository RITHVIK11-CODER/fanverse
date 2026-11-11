
"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

type ShareResultsProps = {
  title: string;
  slug: string;
};

export default function ShareResults({
  title,
  slug,
}: ShareResultsProps) {
  const [copied, setCopied] = useState(false);

  const getShareUrl = () => {
    return `${window.location.origin}/results/${slug}`;
  };

  const handleShare = async () => {
    const url = getShareUrl();

    const shareData = {
      title: `${title} | FanVerse Results`,
      text: `Check out the results of "${title}" on FanVerse!`,
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        console.error("Unable to share or copy the results link.");
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-3 text-sm font-semibold text-black transition hover:brightness-110"
    >
      {copied ? <Check size={17} /> : <Share2 size={17} />}
      {copied ? "Link Copied!" : "Share Results"}
    </button>
  );
}
