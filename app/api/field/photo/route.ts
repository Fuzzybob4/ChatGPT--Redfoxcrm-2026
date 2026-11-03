import { put } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";
import { getAccessibleJob, getFieldContext } from "@/lib/field";

const MAX_BYTES = 10 * 1024 * 1024;

/** Crew members upload install photos for a job they are assigned to. */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const jobId = String(formData.get("jobId") ?? "");

    if (!(file instanceof File) || !jobId) {
      return NextResponse.json({ error: "Missing photo or job." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only images can be uploaded." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Photos must be under 10MB." }, { status: 400 });
    }

    const { org, employee, admin } = await getFieldContext();
    const access = await getAccessibleJob(org.orgId, employee?.id ?? null, org.role, jobId);
    if (!access || !access.job.customerId) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    const { job, raw } = access;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "photo.jpg";
    const description = `${job.jobType === "removal" ? "Removal" : "Install"} photo – ${job.title}`;
    const uploadedBy = org.userId;

    if (job.propertyId) {
      const blob = await put(`properties/${job.propertyId}/photos/${Date.now()}-${safeName}`, file, {
        access: "private",
      });
      const { error } = await admin.from("property_photos").insert({
        property_id: job.propertyId,
        customer_id: job.customerId,
        org_id: org.orgId,
        location_id: raw.location_id ?? null,
        photo_url: blob.pathname,
        file_size: file.size,
        photo_type: file.type,
        description,
        uploaded_by: uploadedBy,
      });
      if (error) return NextResponse.json({ error: "Could not save the photo." }, { status: 500 });
    } else {
      const blob = await put(`customers/${job.customerId}/photos/${Date.now()}-${safeName}`, file, {
        access: "private",
      });
      const { error } = await admin.from("customer_photos").insert({
        customer_id: job.customerId,
        org_id: org.orgId,
        photo_url: blob.pathname,
        file_size: file.size,
        photo_type: "Installation",
        description,
        uploaded_by: uploadedBy,
      });
      if (error) return NextResponse.json({ error: "Could not save the photo." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Field photo upload failed:", error);
    return NextResponse.json({ error: "Photo upload failed." }, { status: 500 });
  }
}
