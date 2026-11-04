import { NextResponse } from "next/server";

/** Turn a thrown upload error into a response the user can act on. */
export function uploadErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/exceeded|too large|payload/i.test(message)) {
    return NextResponse.json({ error: "That photo is too large. Try one under 10MB." }, { status: 413 });
  }
  return NextResponse.json({ error: "Photo upload failed. Please try again." }, { status: 500 });
}
