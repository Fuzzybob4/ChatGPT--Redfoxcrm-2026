import { uploadPhoto } from "@/lib/photo-storage";
import { type NextRequest, NextResponse } from "next/server";
import { getAccessibleJob, getFieldContext } from "@/lib/field";
import { uploadErrorResponse } from "@/lib/upload-error";

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
    const typed = String(formData.get("description") ?? "").trim().slice(0, 500);
    const description = typed || `${job.jobType === "removal" ? "Removal" : "Install"} photo – ${job.title}`;
    const uploadedBy = org.userId;

    if (job.propertyId) {
      const photoUrl = await uploadPhoto(`properties/${job.propertyId}/${Date.now()}-${safeName}`, file);
      const { data: row, error } = await admin.from("property_photos").insert({
        property_id: job.propertyId,
        customer_id: job.customerId,
        org_id: org.orgId,
        location_id: raw.location_id ?? null,
        photo_url: photoUrl,
        file_size: file.size,
        photo_type: file.type,
        description,
        uploaded_by: uploadedBy,
      }).select("id").single();
      if (error) return NextResponse.json({ error: "Could not save the photo." }, { status: 500 });
      return NextResponse.json({ ok: true, id: row.id, table: "property_photos" });
    } else {
      const photoUrl = await uploadPhoto(`customers/${job.customerId}/${Date.now()}-${safeName}`, file);
      const { data: row, error } = await admin.from("customer_photos").insert({
        customer_id: job.customerId,
        org_id: org.orgId,
        photo_url: photoUrl,
        file_size: file.size,
        photo_type: "Installation",
        description,
        uploaded_by: uploadedBy,
      }).select("id").single();
      if (error) return NextResponse.json({ error: "Could not save the photo." }, { status: 500 });
      return NextResponse.json({ ok: true, id: row.id, table: "customer_photos" });
    }
  } catch (error) {
    console.error("Field photo upload failed:", error);
    return uploadErrorResponse(error);
  }
}

/** Add or change a photo's description (the person who took it, or the office). */
export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { id?: string; table?: string; description?: string } | null;
    const table = body?.table === "property_photos" ? "property_photos" : body?.table === "customer_photos" ? "customer_photos" : null;
    if (!body?.id || !table) return NextResponse.json({ error: "Missing photo." }, { status: 400 });
    const { org, admin } = await getFieldContext();
    const description = String(body.description ?? "").trim().slice(0, 500);
    const isOffice = ["owner", "admin", "manager"].includes(String(org.role ?? "").toLowerCase());
    let q = admin.from(table).update({ description, updated_at: new Date().toISOString() }).eq("id", body.id).eq("org_id", org.orgId);
    if (!isOffice) q = q.eq("uploaded_by", org.userId);
    const { data, error } = await q.select("id");
    if (error || !data?.length) return NextResponse.json({ error: "Couldn't save the note." }, { status: 403 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Field photo note failed:", error);
    return NextResponse.json({ error: "Couldn't save the note." }, { status: 500 });
  }
}
