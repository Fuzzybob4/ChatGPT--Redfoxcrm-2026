"use client";

import { useState, useTransition } from "react";
import { Plus, Mail, HardHat, Map, UserX } from "lucide-react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addEmployee,
  inviteEmployee,
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

const CREW_ROLES = [
  { value: "technician", label: "Technician" },
  { value: "crew_lead", label: "Crew Lead" },
  { value: "installer", label: "Installer" },
  { value: "driver", label: "Driver" },
  { value: "manager", label: "Manager" },
  { value: "supervisor", label: "Supervisor" },
  { value: "sales", label: "Sales" },
  { value: "office", label: "Office Staff" },
];

export function CrewList({ members }: { members: CrewMember[] }) {
  const [open, setOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
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

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInviteError(null);
    const form = new FormData(e.currentTarget);
    form.set("role", inviteRole);
    const result = await inviteEmployee(form);
    if (result?.error) {
      setInviteError(result.error);
    } else {
      setInviteSent(true);
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

        <div className="flex gap-2">
          {/* Invite via email */}
          <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) { setInviteSent(false); setInviteError(null); setInviteRole(""); } }}>
            <DialogTrigger render={<Button variant="outline" className="gap-2" />}>
              <Mail className="w-4 h-4" />
              Invite Employee
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Invite Employee</DialogTitle>
              </DialogHeader>
              {inviteSent ? (
                <div className="py-6 flex flex-col items-center gap-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Invite sent!</p>
                    <p className="text-muted-foreground text-sm mt-1">
                      <span className="text-foreground font-medium">{inviteEmail}</span> will receive an email to set up their account and complete their profile.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => { setInviteSent(false); setInviteEmail(""); setInviteRole(""); }}>
                    Invite another
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleInvite} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-email">Employee email</Label>
                    <Input
                      id="invite-email"
                      name="email"
                      type="email"
                      required
                      placeholder="employee@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Job role / Access level</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v ?? '')} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CREW_ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
                  <p className="text-xs text-muted-foreground">
                    The employee will receive an email to set their password and complete their profile with legal information before they can access the system.
                  </p>
                  <Button type="submit" className="w-full" disabled={!inviteRole || isPending}>
                    Send Invite
                  </Button>
                </form>
              )}
            </DialogContent>
          </Dialog>

          {/* Manual add */}
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
