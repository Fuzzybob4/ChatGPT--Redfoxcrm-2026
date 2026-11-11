import { redirect } from "next/navigation";

// The old "Homes" list showed every home in the business. Crews now only see
// their own jobs and customers, so this page sends them to My jobs.
export default function FieldHomesPage() {
  redirect("/field");
}
