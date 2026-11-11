"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadBusinessRules, type BusinessRules } from "@/lib/schedule-server";

export type BusinessRulesInput = {
  timezone: string;
  seasonStartMonth: number;
  seasonStartDay: number;
  daySlots: [string, string][];
  sizePoints: { small: number; standard: number; large: number };
  crewHidePrices: boolean;
  removalStartMonth: number;
  removalStartDay: number;
  rebookAuto: boolean;
  rebookDepositPercent: number;
  contractOffer: boolean;
  contractYears: number;
  contractPercent: number;
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function getBusinessRules(): Promise<BusinessRules | null> {
  const org = await getCurrentOrg();
  if (!org) return null;
  return loadBusinessRules(createAdminClient(), org.orgId);
}

export async function saveBusinessRules(input: BusinessRulesInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "Not signed in." };
  if (!["owner", "admin"].includes(String(org.role ?? "").toLowerCase())) {
    return { ok: false, error: "Only owners and admins can change these settings." };
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: input.timezone });
  } catch {
    return { ok: false, error: "Pick a valid time zone." };
  }
  const month = Math.round(Number(input.seasonStartMonth));
  const day = Math.round(Number(input.seasonStartDay));
  if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 28)) {
    return { ok: false, error: "Season start must be a real date (day 1–28)." };
  }
  const slots = (input.daySlots ?? []).filter((s) => Array.isArray(s) && TIME.test(s[0]) && TIME.test(s[1]) && s[0] < s[1]);
  if (!slots.length || slots.length > 8) return { ok: false, error: "Add between 1 and 8 time windows (start before end)." };
  const pts = input.sizePoints ?? { small: 0.75, standard: 1, large: 1.5 };
  for (const v of [pts.small, pts.standard, pts.large]) {
    if (!(typeof v === "number" && v > 0 && v <= 10)) return { ok: false, error: "Job sizes must be between 0 and 10." };
  }

  const rMonth = Math.round(Number(input.removalStartMonth));
  const rDay = Math.round(Number(input.removalStartDay));
  if (!(rMonth >= 1 && rMonth <= 12) || !(rDay >= 1 && rDay <= 28)) {
    return { ok: false, error: "Removal start must be a real date (day 1–28)." };
  }
  const depositPct = Number(input.rebookDepositPercent);
  if (!(depositPct >= 0 && depositPct <= 100)) return { ok: false, error: "Deposit must be 0–100%." };

  const { error } = await createAdminClient()
    .from("schedule_settings")
    .upsert(
      {
        org_id: org.orgId,
        timezone: input.timezone,
        season_start_month: month,
        season_start_day: day,
        day_slots: slots,
        job_size_points: { small: pts.small, standard: pts.standard, large: pts.large },
        crew_hide_prices: Boolean(input.crewHidePrices),
        removal_start_month: rMonth,
        removal_start_day: rDay,
        rebook_auto: Boolean(input.rebookAuto),
        rebook_deposit_percent: depositPct,
        contract_offer: Boolean(input.contractOffer),
        contract_years: Math.min(10, Math.max(1, Math.round(Number(input.contractYears) || 3))),
        contract_percent: Math.min(100, Math.max(1, Number(input.contractPercent) || 10)),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" },
    );
  if (error) return { ok: false, error: "Couldn't save." };
  revalidatePath("/", "layout");
  return { ok: true };
}
