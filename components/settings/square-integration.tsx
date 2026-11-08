"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, RefreshCw, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { disconnectSquare, syncSquare, type SquareSyncResult } from "@/app/(crm)/settings/integration-actions";
import type { HubspotStatus } from "@/components/settings/hubspot-integration";

export type SquareStatus = Omit<HubspotStatus, "lastSyncResult"> & {
  lastSyncResult: (Omit<SquareSyncResult, "success"> & { error?: string }) | null;
};

const CALLBACK_MESSAGES: Record<string, string> = {
  cancelled: "Square connection was cancelled.",
  invalid_state: "That connection link expired. Please try connecting again.",
  forbidden: "Only owners and admins can connect Square.",
  not_configured: "Square isn't set up on Red Fox yet. Please contact support.",
  error: "We couldn't finish connecting to Square. Please try again.",
};

function summarize(r: SquareStatus["lastSyncResult"] | SquareSyncResult | null) {
  if (!r || r.customersCreated == null) return null;
  const parts = [`${r.customersCreated} new customers`];
  if (r.customersLinked) parts.push(`${r.customersLinked} matched`);
  parts.push(`${r.invoicesCreated ?? 0} invoices imported`);
  if (r.invoicesUpdated) parts.push(`${r.invoicesUpdated} invoices updated`);
  if (r.mapped) parts.push(`${r.mapped} placed on the map`);
  return parts.join(" · ");
}

export function SquareIntegration({ status, callbackStatus }: { status: SquareStatus; callbackStatus?: string | null }) {
  const [connected, setConnected] = useState(status.connected);
  const [result, setResult] = useState<string | null>(summarize(status.lastSyncResult));
  const [error, setError] = useState<string | null>(callbackStatus ? CALLBACK_MESSAGES[callbackStatus] ?? null : null);
  const [lastSyncAt, setLastSyncAt] = useState(status.lastSyncAt);
  const [isSyncing, startSync] = useTransition();
  const [isDisconnecting, startDisconnect] = useTransition();
  const autoStarted = useRef(false);

  function runSync() {
    setError(null);
    startSync(async () => {
      const res = await syncSquare();
      if (!res.success) return setError(res.error ?? "Import failed");
      setResult(summarize(res));
      setLastSyncAt(new Date().toISOString());
    });
  }

  useEffect(() => {
    if (callbackStatus === "connected" && status.connected && !autoStarted.current) {
      autoStarted.current = true;
      runSync();
      const url = new URL(window.location.href);
      url.searchParams.delete("square");
      window.history.replaceState(null, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbackStatus, status.connected]);

  function handleDisconnect() {
    if (!window.confirm("Disconnect Square? Customers and invoices already imported stay in Red Fox.")) return;
    startDisconnect(async () => {
      const res = await disconnectSquare();
      if (res.success) {
        setConnected(false);
        setResult(null);
      } else setError(res.error ?? "Could not disconnect");
    });
  }

  return (
    <div className="flex flex-col gap-3 py-4 first:pt-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-muted border border-border">
          <Upload className="size-4 text-primary" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Square</p>
            <Badge variant="outline" className="text-[10px] px-1.5 h-4">Payments Import</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {connected
              ? `Connected${status.accountName ? ` to ${status.accountName}` : ""}. Customers and invoice payments sync automatically.`
              : "Import your Square customers and invoices. Square payments mark Red Fox invoices paid automatically. Read-only."}
          </p>
          {isSyncing && (
            <p className="text-xs text-primary mt-1 flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" /> Importing from Square… this can take a few minutes.
            </p>
          )}
          {!isSyncing && result && <p className="text-xs text-emerald-700 mt-1">{result}</p>}
          {!isSyncing && lastSyncAt && connected && (
            <p className="text-[10px] text-muted-foreground mt-0.5">Last synced {new Date(lastSyncAt).toLocaleString()}</p>
          )}
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {connected ? (
          <>
            <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 text-xs gap-1">
              <Check className="size-3" /> Connected
            </Badge>
            <Button size="sm" variant="outline" onClick={runSync} disabled={isSyncing || isDisconnecting}>
              <RefreshCw className={isSyncing ? "animate-spin" : ""} /> Sync now
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDisconnect} disabled={isSyncing || isDisconnecting}>
              Disconnect
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => { window.location.href = "/api/integrations/square/connect"; }}>
            Connect Square
          </Button>
        )}
      </div>
    </div>
  );
}
