"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Edit, Wrench } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export interface Vehicle {
  id: string;
  name: string;
  makeModel: string;
  licensePlate: string;
  year?: number;
  color?: string;
  mileage: number;
  status: string;
  locationId: string;
  assignedTo?: string | null;
}

export function VehiclesList({ vehicles }: { vehicles: Vehicle[] }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = vehicles.filter(
    (v) =>
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.licensePlate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.makeModel.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-50 text-green-700 border-green-200";
      case "maintenance":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "retired":
        return "bg-gray-50 text-gray-700 border-gray-200";
      default:
        return "bg-blue-50 text-blue-700 border-blue-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, plate, or model..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button size="sm" render={<Link href="/vehicles/new" />} className="gap-2">
          <Plus className="size-4" />
          Add Vehicle
        </Button>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Vehicles ({filtered.length})</CardTitle>
            <CardDescription>Manage your fleet and assign to crew members</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-xs uppercase tracking-wide text-muted-foreground">
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Make / Model</TableHead>
                  <TableHead>License Plate</TableHead>
                  <TableHead>Mileage</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{vehicle.name}</div>
                      {vehicle.color && (
                        <div className="text-xs text-muted-foreground">{vehicle.color}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{vehicle.makeModel}</TableCell>
                    <TableCell className="text-sm font-mono">{vehicle.licensePlate}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {vehicle.mileage.toLocaleString()} mi
                    </TableCell>
                    <TableCell className="text-sm">
                      {vehicle.assignedTo ? (
                        <span className="text-blue-600 font-medium">{vehicle.assignedTo}</span>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`capitalize text-xs ${getStatusColor(vehicle.status)}`}
                      >
                        {vehicle.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={`/vehicles/${vehicle.id}/maintenance`} />}
                        title="View maintenance"
                      >
                        <Wrench className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={`/vehicles/${vehicle.id}/edit`} />}
                        title="Edit vehicle"
                      >
                        <Edit className="size-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                      No vehicles found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((vehicle) => (
          <Card key={vehicle.id} className="cursor-pointer hover:border-primary/50 transition-colors">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{vehicle.name}</p>
                    <p className="text-xs text-muted-foreground">{vehicle.makeModel}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`capitalize text-xs ${getStatusColor(vehicle.status)}`}
                  >
                    {vehicle.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Plate:</span>
                    <p className="font-mono">{vehicle.licensePlate}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mileage:</span>
                    <p>{vehicle.mileage.toLocaleString()} mi</p>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Assigned To:</span>
                  <p className="text-sm font-medium">
                    {vehicle.assignedTo || "Unassigned"}
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    render={<Link href={`/vehicles/${vehicle.id}/maintenance`} />}
                  >
                    <Wrench className="size-3 mr-1" />
                    Maintenance
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    render={<Link href={`/vehicles/${vehicle.id}/edit`} />}
                  >
                    <Edit className="size-3 mr-1" />
                    Edit
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No vehicles found
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
