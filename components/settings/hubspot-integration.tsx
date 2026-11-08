"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, RefreshCw, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  disconnectHubspot,
  syncHubspotContacts,
  type HubspotSyncResult,
} from "@/app/(crm)/settings/integration-actions";

export interface HubspotStatus {
  connected: boolean;
  accountName: string | null;
  lastSyncAt: string | null;
  lastSyncResult: { total?: number; created?: number; linked?: number; skipped?: number; error?: string } | null;
}

const CALLBACK_MESSAGES: Record<string, string> = {
  cancelled: "HubSpot connection was cancelled.",
  invalid_state: "That connection link expired. Please try connecting again.",
  forbidden: "Only owners and admins can connect HubSpot.",
  not_configured: "HubSpot isn't set up on Red Fox yet. Please contact support.",
  error: "We couldn't finish connecting to HubSpot. Please try again.",
};

function summarize(r: HubspotStatus["lastSyncResult"] | HubspotSyncResult | null) {
  if (!r || r.total == null) return null;
  const parts = [`${r.created ?? 0} new customers imported`];
  if (r.linked) parts.push(`${r.linked} matched to existing customers`);
  if (r.skipped) parts.push(`${r.skipped} skipped (already imported or duplicates)`);
  return parts.join(" · ");
}

export function HubspotIntegration({
  status,
  callbackStatus,
}: {
  status: HubspotStatus;
  callbackStatus?: string | null;
}) {
  const [connected, setConnected] = useState(status.connected);
  const [result, setResult] = useState<string | null>(summarize(status.lastSyncResult));
  const [error, setError] = useState<string | null>(
    callbackStatus && CALLBACK_MESSAGES[callbackStatus] ? CALLBACK_MESSAGES[callbackStatus] : null,
  );
  const [lastSyncAt, setLastSyncAt] = useState(status.lastSyncAt);
  const [isSyncing, startSync] = useTransition();
  const [isDisconnecting, startDisconnect] = useTransition();
  const autoStarted = useRef(false);

  function runSync() {
    setError(null);
    startSync(async () => {
      const res = await syncHubspotContacts();
      if (!res.success) {
        setError(res.error ?? "Import failed");
        return;
      }
      setResult(summarize(res));
      setLastSyncAt(new Date().toISOString());
    });
  }

  // Right after a business connects HubSpot, start the first import automatically.
  useEffect(() => {
    if (callbackStatus === "connected" && status.connected && !autoStarted.current) {
      autoStarted.current = true;
      runSync();
      const url = new URL(window.location.href);
      url.searchParams.delete("hubspot");
      window.history.replaceState(null, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbackStatus, status.connected]);

  function handleDisconnect() {
    if (!window.confirm("Disconnect HubSpot? Customers you already imported will stay in Red Fox.")) return;
    startDisconnect(async () => {
      const res = await disconnectHubspot();
      if (res.success) {
        setConnected(false);
        setResult(null);
      } else {
        setError(res.error ?? "Could not disconnect");
      }
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
            <p className="text-sm font-medium">HubSpot</p>
            <Badge variant="outline" className="text-[10px] px-1.5 h-4">CRM Import</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {connected
              ? `Connected${status.accountName ? ` to ${status.accountName}` : ""}. Imports your HubSpot contacts as customers and leads.`
              : "Import your HubSpot contacts as customers and leads. Read-only — Red Fox never changes your HubSpot data."}
          </p>
          {isSyncing && (
            <p className="text-xs text-primary mt-1 flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" /> Importing contacts… this can take a minute.
            </p>
          )}
          {!isSyncing && result && <p className="text-xs text-emerald-700 mt-1">{result}</p>}
          {!isSyncing && lastSyncAt && connected && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Last synced {new Date(lastSyncAt).toLocaleString()}
            </p>
          )}
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {connected ? (
          <>
            <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 text-xs gap-1">
              <Check className="size-3" />
              Connected
            </Badge>
            <Button size="sm" variant="outline" onClick={runSync} disabled={isSyncing || isDisconnecting}>
              <RefreshCw className={isSyncing ? "animate-spin" : ""} />
              Sync now
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDisconnect} disabled={isSyncing || isDisconnecting}>
              Disconnect
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => { window.location.href = "/api/integrations/hubspot/connect"; }}>
            Connect HubSpot
          </Button>
        )}
      </div>
    </div>
  );
}
