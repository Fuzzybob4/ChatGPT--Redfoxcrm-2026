import { notFound } from "next/navigation";
import { getFieldContext } from "@/lib/field";
import { getCrewOptions, getWorkOrderCustomer } from "@/lib/field-homes";
import { NotAllowed, WorkOrderForm } from "@/components/field/work-order-form";

import { addDays, todayIn } from "@/lib/schedule";
import { loadBusinessRules } from "@/lib/schedule-server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function NewFieldWorkOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; type?: string }>;
}) {
  const { customer: customerId, type } = await searchParams;
  const { org, employee, canManageWorkOrders } = await getFieldContext();
  const tomorrowDay = addDays(todayIn((await loadBusinessRules(createAdminClient(), org.orgId)).timezone), 1);
  const tomorrow = () => tomorrowDay;
  if (!canManageWorkOrders) return <NotAllowed />;
  if (!customerId) notFound();

  const [customer, crew] = await Promise.all([getWorkOrderCustomer(org.orgId, customerId), getCrewOptions(org.orgId)]);
  if (!customer) notFound();

  const jobType = type === "removal" || type === "service" ? type : "install";

  return (
    <WorkOrderForm
      mode="create"
      customerId={customer.id}
      customerName={customer.name}
      address={[customer.address, customer.city, customer.state, customer.zipCode].filter(Boolean).join(", ")}
      crew={crew}
      initial={{
        jobType,
        scheduledDate: tomorrow(),
        startTime: "09:00",
        endTime: "12:00",
        assignedEmployees: employee ? [employee.id] : [],
        notes: "",
      }}
    />
  );
}
