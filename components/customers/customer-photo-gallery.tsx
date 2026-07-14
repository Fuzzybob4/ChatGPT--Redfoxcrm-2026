"use client";

import { useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CustomerPhoto } from "@/lib/data";

interface CustomerPhotoGalleryProps {
  photos: CustomerPhoto[];
}

export function CustomerPhotoGallery({ photos }: CustomerPhotoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!photos.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Property Photos</CardTitle>
          <CardDescription>No photos uploaded yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const selected = selectedIndex !== null ? photos[selectedIndex] : null;

  const handlePrev = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex - 1 + photos.length) % photos.length);
    }
  };

  const handleNext = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex + 1) % photos.length);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Property Photos</CardTitle>
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
                <Image
                  src={photo.photoUrl}
                  alt={photo.description || `Property photo ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lightbox Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedIndex(null)}
        >
          <div
            className="relative max-w-4xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedIndex(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 z-10"
            >
              <X className="size-8" />
            </button>

            {/* Image */}
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <Image
                src={selected.photoUrl}
                alt={selected.description || "Property photo"}
                fill
                className="object-contain"
                sizes="(max-width: 1024px) 90vw, 80vw"
                priority
              />
            </div>

            {/* Navigation */}
            {photos.length > 1 && (
              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePrev}
                  className="bg-black/50 border-white/20 text-white hover:bg-black/70"
                >
                  <ChevronLeft className="size-4" />
                </Button>

                <div className="text-center text-white text-sm">
                  {selectedIndex! + 1} / {photos.length}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNext}
                  className="bg-black/50 border-white/20 text-white hover:bg-black/70"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}

            {/* Photo details */}
            <div className="mt-4 bg-black/50 rounded-lg p-3 text-white text-sm space-y-1">
              {selected.description && (
                <p className="font-medium">{selected.description}</p>
              )}
              {selected.photoType && (
                <div className="flex gap-2">
                  <Badge variant="secondary" className="bg-white/20 text-white">
                    {selected.photoType}
                  </Badge>
                </div>
              )}
              {selected.createdAt && (
                <p className="text-xs text-gray-300">
                  {new Date(selected.createdAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
