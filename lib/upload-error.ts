import { NextResponse } from "next/server";
import { BlobStoreSuspendedError } from "@vercel/blob";

/** Turn a thrown upload error into a response the user can act on. */
export function uploadErrorResponse(error: unknown) {
  if (error instanceof BlobStoreSuspendedError) {
    return NextResponse.json(
      {
        error:
          "Photo storage is suspended on your Vercel account. Check Storage and billing in your Vercel dashboard to re-enable uploads.",
      },
      { status: 503 },
    );
  }
  return NextResponse.json({ error: "Photo upload failed. Please try again." }, { status: 500 });
}
