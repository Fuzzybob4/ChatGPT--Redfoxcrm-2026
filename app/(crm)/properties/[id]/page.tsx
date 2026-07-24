"use client";

import { use, useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Home } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { useData } from "@/lib/data-context";
import { PropertyPhotoUploader } from "@/components/properties/property-photo-uploader";
import { PropertyPhotoGallery } from "@/components/properties/property-photo-gallery";

interface Props {
  params: Promise<{ id: string }>;
}

export default function PropertyDetailPage({ params }: Props) {
  const { id } = use(params);
  const { loading, refresh, getCustomerProperties } = useData();
  const [allProperties] = useState(() => getCustomerProperties(""));
  
  const property = allProperties.find((p) => p.id === id);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!property) notFound();

  const fullAddress = [property.address, property.city, property.state, property.zip]
    .filter(Boolean)
    .join(", ");

  // Mock data for now - in a real app, fetch property photos from useData
  const propertyPhotos: any[] = [];

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader
        title={property.propertyName || property.address}
        description={fullAddress}
        actions={
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/customers" />}
          >
            <ArrowLeft className="size-3.5" data-icon="inline-start" />
            Back
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* Left Column */}
          <div className="flex flex-col gap-4 lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="size-4" />
                  Property Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Type</p>
                  <Badge variant="outline">{property.propertyType}</Badge>
                </div>
                
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Address</p>
                  <div className="flex items-start gap-2">
                    <MapPin className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-sm font-medium">{fullAddress}</p>
                  </div>
                </div>

                {property.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm text-foreground">{property.notes}</p>
                  </div>
                )}

                <div className="pt-2 space-y-2 border-t">
                  {property.isPrimary && (
                    <Badge className="w-full justify-center">Primary Property</Badge>
                  )}
                  {property.isServiceAddress && (
                    <Badge variant="secondary" className="w-full justify-center">
                      Service Address
                    </Badge>
                  )}
                  {property.isBillingAddress && (
                    <Badge variant="secondary" className="w-full justify-center">
                      Billing Address
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Photos */}
          <div className="flex flex-col gap-4 lg:col-span-2">
            <PropertyPhotoUploader
              propertyId={property.id}
              customerId={property.customerId}
              onPhotoAdded={() => refresh()}
            />
            
            <PropertyPhotoGallery
              photos={propertyPhotos}
              onPhotoDeleted={() => refresh()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
