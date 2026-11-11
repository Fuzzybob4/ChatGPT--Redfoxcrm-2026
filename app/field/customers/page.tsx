import { getAssignedCustomers, getFieldContext } from "@/lib/field";
import { FieldCustomerList } from "@/components/field/field-customer-list";
import { NoEmployeeProfile } from "@/components/field/no-employee-profile";

export default async function FieldCustomersPage() {
  const { org, employee, canRunJobs } = await getFieldContext();
  if (!employee) return <NoEmployeeProfile role={org.role} />;

  const customers = await getAssignedCustomers(org.orgId, employee.id, canRunJobs);
  return <FieldCustomerList customers={customers} lead={canRunJobs} />;
}
