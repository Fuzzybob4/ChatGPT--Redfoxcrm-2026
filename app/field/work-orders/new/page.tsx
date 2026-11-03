import { notFound } from "next/navigation";
import { getFieldContext } from "@/lib/field";
import { getCrewOptions, getWorkOrderCustomer } from "@/lib/field-homes";
import { NotAllowed, WorkOrderForm } from "@/components/field/work-order-form";

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

export default async function NewFieldWorkOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; type?: string }>;
}) {
  const { customer: customerId, type } = await searchParams;
  const { org, employee, canManageWorkOrders } = await getFieldContext();
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
