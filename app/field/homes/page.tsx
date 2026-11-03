import { getFieldContext } from "@/lib/field";
import { getLeadHomes } from "@/lib/field-homes";
import { HomesView } from "@/components/field/homes-view";
import { NotAllowed } from "@/components/field/work-order-form";

export default async function FieldHomesPage() {
  const { org, employee, canManageWorkOrders } = await getFieldContext();
  if (!canManageWorkOrders) return <NotAllowed />;

  const homes = await getLeadHomes(org.orgId, employee?.locationId ?? null);
  return <HomesView homes={homes} />;
}
