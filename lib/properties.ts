import "server-only";

/** Returns the property id only if it belongs to this customer in this business; otherwise null. */
export async function validPropertyId(
  db: { from: (t: string) => any },
  orgId: string,
  customerId: string,
  propertyId: string | null | undefined,
): Promise<string | null> {
  if (!propertyId) return null;
  const { data } = await db
    .from("customer_properties")
    .select("id")
    .eq("id", propertyId)
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .maybeSingle();
  return data?.id ?? null;
}

/** "120 Spotted Bass Ln, San Marcos, TX 78666" for a property id (or null). */
export async function propertyAddress(
  db: { from: (t: string) => any },
  orgId: string,
  propertyId: string | null | undefined,
): Promise<{ name: string | null; address: string } | null> {
  if (!propertyId) return null;
  const { data } = await db
    .from("customer_properties")
    .select("property_name, address, city, state, zip_code")
    .eq("id", propertyId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!data) return null;
  return {
    name: data.property_name ?? null,
    address: [data.address, data.city, [data.state, data.zip_code].filter(Boolean).join(" ")].filter(Boolean).join(", "),
  };
}
