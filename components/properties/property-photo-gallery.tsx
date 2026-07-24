"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PropertyPhoto } from "@/lib/data";

interface PropertyPhotoGalleryProps {
  photos: PropertyPhoto[];
  onPhotoDeleted?: () => void;
}

export function PropertyPhotoGallery({ photos, onPhotoDeleted }: PropertyPhotoGalleryProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (photoId: string, photoUrl: string) => {
    if (!confirm("Delete this photo?")) return;

    setDeletingId(photoId);
    try {
      const response = await fetch("/api/delete/property-photo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId, pathname: photoUrl }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete photo");
      }

      if (onPhotoDeleted) {
        onPhotoDeleted();
      }
    } catch (error) {
      alert(`Delete failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setDeletingId(null);
    }
  };

  if (photos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Property Photos</CardTitle>
          <CardDescription>No photos yet</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-muted-foreground">Upload photos to showcase this property</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Property Photos</CardTitle>
        <CardDescription>{photos.length} photo{photos.length !== 1 ? "s" : ""}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group rounded-lg overflow-hidden bg-muted h-48">
              <img
                src={`/api/file/property-photo?pathname=${encodeURIComponent(photo.photoUrl)}`}
                alt={photo.description || "Property photo"}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23e5e7eb' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='16' fill='%239ca3af'%3EPhoto unavailable%3C/text%3E%3C/svg%3E";
                }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                <Button
                  size="icon"
                  variant="destructive"
                  onClick={() => handleDelete(photo.id, photo.photoUrl)}
                  disabled={deletingId === photo.id}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {deletingId === photo.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </div>
              {photo.description && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2">
                  <p className="text-xs text-white line-clamp-2">{photo.description}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
