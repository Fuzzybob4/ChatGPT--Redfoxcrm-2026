"use client";

import { useState, useTransition } from "react";
import { Plus, HardHat, Map, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  addEmployee,
  updateEmployeeAccess,
  removeEmployee,
} from "@/app/(crm)/crew/actions";

export interface CrewMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  crewName: string;
  isActive: boolean;
  canWorkOrders: boolean;
  canMapping: boolean;
}

function AccessToggle({
  enabled,
  label,
  icon: Icon,
  onToggle,
  disabled,
}: {
  enabled: boolean;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={enabled}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
        enabled
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

export function CrewList({ members }: { members: CrewMember[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const active = members.filter((m) => m.isActive);
  const crews = Array.from(new Set(active.map((m) => m.crewName).filter(Boolean)));

  function handleToggle(
    id: string,
    field: "can_access_work_orders" | "can_access_mapping",
    value: boolean
  ) {
    startTransition(async () => {
      await updateEmployeeAccess(id, field, value);
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      await removeEmployee(id);
    });
  }

  async function handleAdd(formData: FormData) {
    setError(null);
    const result = await addEmployee(formData);
    if (result?.error) {
      setError(result.error);
    } else {
      setOpen(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary + Add */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-6 text-sm">
          <div>
            <p className="text-2xl font-bold text-foreground">{active.length}</p>
            <p className="text-muted-foreground text-xs">Active members</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{crews.length}</p>
            <p className="text-muted-foreground text-xs">Crews</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {active.filter((m) => m.canMapping).length}
            </p>
            <p className="text-muted-foreground text-xs">With mapping access</p>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="gap-2" />}>
            <Plus className="w-4 h-4" />
            Add Crew Member
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Crew Member</DialogTitle>
            </DialogHeader>
            <form action={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input id="firstName" name="firstName" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" name="lastName" required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" type="tel" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="position">Position</Label>
                  <Input id="position" name="position" placeholder="Installer, Crew Lead..." />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="crewName">Crew</Label>
                <Input id="crewName" name="crewName" placeholder="Crew A" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Access</p>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" name="canWorkOrders" defaultChecked className="accent-primary" />
                  Work orders
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" name="canMapping" className="accent-primary" />
                  Mapping
                </label>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full">
                Add Member
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Members table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead className="hidden md:table-cell">Crew</TableHead>
              <TableHead className="hidden lg:table-cell">Phone</TableHead>
              <TableHead>Access</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {active.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  No crew members yet. Add your first member to get started.
                </TableCell>
              </TableRow>
            )}
            {active.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {m.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {m.position || m.email}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {m.crewName ? (
                    <Badge variant="secondary">{m.crewName}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                  {m.phone || "—"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    <AccessToggle
                      enabled={m.canWorkOrders}
                      label="Work orders"
                      icon={HardHat}
                      disabled={isPending}
                      onToggle={() =>
                        handleToggle(m.id, "can_access_work_orders", !m.canWorkOrders)
                      }
                    />
                    <AccessToggle
                      enabled={m.canMapping}
                      label="Mapping"
                      icon={Map}
                      disabled={isPending}
                      onToggle={() =>
                        handleToggle(m.id, "can_access_mapping", !m.canMapping)
                      }
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isPending}
                    onClick={() => handleRemove(m.id)}
                    aria-label={`Deactivate ${m.name}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <UserX className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
