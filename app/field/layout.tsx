import type { Metadata } from "next";
import { getFieldContext } from "@/lib/field";
import { FieldHeader } from "@/components/field/field-header";
import { FieldTabs } from "@/components/field/field-tabs";

export const metadata: Metadata = {
  title: "RedFox Field",
  description: "Your jobs, install photos, and job timer.",
};

export const dynamic = "force-dynamic";

export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  const { org, employee, canManageWorkOrders } = await getFieldContext();
  const isOffice = ["owner", "admin", "manager"].includes(org.role);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <FieldHeader name={employee?.name ?? org.businessName} officeLink={isOffice} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col">{children}</main>
      <FieldTabs showHomes={canManageWorkOrders} />
    </div>
  );
}
