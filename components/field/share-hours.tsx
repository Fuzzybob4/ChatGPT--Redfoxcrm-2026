"use client";

import { useState } from "react";
import { Copy, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Send the week's clock times to the boss: share sheet (text, email) or copy. */
export function ShareHours({ text, title }: { text: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your hours:", text);
    }
  }

  async function share() {
    try {
      await navigator.share({ title, text });
    } catch {
      /* closed the share sheet */
    }
  }

  return (
    <div className="flex gap-2">
      {canShare && (
        <Button className="h-12 flex-1" onClick={share}>
          <Share2 className="size-4" />
          Send my hours
        </Button>
      )}
      <Button variant={canShare ? "outline" : "default"} className="h-12 flex-1" onClick={copy}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copied" : "Copy hours"}
      </Button>
    </div>
  );
}
