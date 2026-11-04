import { getFieldContext } from "@/lib/field";
import { getLeadHomes } from "@/lib/field-homes";
import { HomesView } from "@/components/field/homes-view";

export default async function FieldMapPage() {
  const { org, employee, canManageWorkOrders } = await getFieldContext();

  const homes = await getLeadHomes(org.orgId, employee?.locationId ?? null, employee?.id ?? null);
  return <HomesView homes={homes} title="Map" defaultView="map" canManage={canManageWorkOrders} />;
}
