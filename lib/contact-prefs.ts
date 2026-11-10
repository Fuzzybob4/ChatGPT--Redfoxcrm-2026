/**
 * Contact preferences. Promotional outreach (marketing emails, rebooking texts,
 * sales calls) must skip anyone who opted out. Transactional messages tied to
 * work the customer already bought (invoices, receipts, schedule changes) are
 * still allowed.
 */
export type ContactPrefs = {
  doNotContact: boolean;
  doNotContactAt: string | null;
  doNotContactReason: string | null;
  emailOptOut: boolean;
  textOptOut: boolean;
};

type PrefRow = {
  do_not_contact?: boolean | null;
  marketing_unsubscribed?: boolean | null;
  sms_opt_out?: boolean | null;
};

export function canMarketByEmail(row: PrefRow): boolean {
  return !row.do_not_contact && !row.marketing_unsubscribed;
}

export function canMarketByText(row: PrefRow): boolean {
  return !row.do_not_contact && !row.sms_opt_out;
}

export function canMarketByPhone(row: PrefRow): boolean {
  return !row.do_not_contact;
}
