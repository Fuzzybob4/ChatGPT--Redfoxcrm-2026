"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { PhotoViewer } from "@/components/field/photo-viewer";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import type { CustomerPhoto } from "@/lib/data";

interface CustomerPhotoGalleryProps {
  photos: CustomerPhoto[];
  onPhotoDeleted?: (pathname: string) => void;
  canDelete?: boolean;
}

export function CustomerPhotoGallery({ photos, onPhotoDeleted, canDelete = true }: CustomerPhotoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  if (!photos.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customer Photos</CardTitle>
          <CardDescription>No photos uploaded yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // New uploads live in private storage and are served through an
  // org-checked route; older public Blob links load directly.
  const photoSrc = (photoUrl: string) =>
    /^https?:\/\//i.test(photoUrl) ? photoUrl : `/api/file/photo?pathname=${encodeURIComponent(photoUrl)}`;

  const handleDelete = async (pathname: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) {
      return;
    }

    setDeleting(pathname);
    try {
      const response = await fetch('/api/delete/photo', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathname }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete photo');
      }

      if (onPhotoDeleted) {
        onPhotoDeleted(pathname);
      }

      setSelectedIndex(null);
    } catch (error) {
      alert('Failed to delete photo: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Customer Photos</CardTitle>
          <CardDescription>
            {photos.length} {photos.length === 1 ? "photo" : "photos"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {photos.map((photo, idx) => (
              <button
                key={photo.id}
                onClick={() => setSelectedIndex(idx)}
                className="relative group overflow-hidden rounded-lg aspect-square bg-muted hover:opacity-75 transition-opacity"
              >
                <img
                  src={photoSrc(photo.photoUrl)}
                  alt={photo.description || `Customer photo ${idx + 1}`}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedIndex !== null && (
        <PhotoViewer
          photos={photos.map((p) => ({
            src: photoSrc(p.photoUrl),
            caption: [p.description, p.photoType].filter(Boolean).join(" · ") || "Photo",
            date: p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : undefined,
          }))}
          index={selectedIndex}
          onIndex={setSelectedIndex}
          onClose={() => setSelectedIndex(null)}
          footer={
            canDelete
              ? (i) => (
                  <button
                    type="button"
                    onClick={() => handleDelete(photos[i].photoUrl)}
                    disabled={deleting === photos[i].photoUrl}
                    className="flex h-11 items-center gap-2 rounded-full bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Trash2 className="size-4" /> Delete photo
                  </button>
                )
              : undefined
          }
        />
      )}
    </>
  );
}
