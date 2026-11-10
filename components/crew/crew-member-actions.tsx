"use client";

import { useState, useTransition } from "react";
import { Pencil, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CrewSelect } from "@/components/crews/crew-select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { removeEmployee, updateEmployee } from "@/app/(crm)/crew/actions";
import type { CrewMember } from "@/components/crew/crew-list";

export const CREW_ROLES = [
  { value: "technician", label: "Technician" },
  { value: "crew_lead", label: "Crew Lead" },
  { value: "installer", label: "Installer" },
  { value: "driver", label: "Driver" },
  { value: "manager", label: "Manager" },
  { value: "supervisor", label: "Supervisor" },
  { value: "sales", label: "Sales" },
  { value: "office", label: "Office Staff" },
];

export function CrewMemberActions({ member }: { member: CrewMember }) {
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-11 text-muted-foreground hover:text-foreground"
        onClick={() => setEditOpen(true)}
        aria-label={`Edit ${member.name}`}
      >
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 text-muted-foreground hover:text-destructive"
        onClick={() => setRemoveOpen(true)}
        aria-label={`Remove ${member.name}`}
      >
        <UserX className="size-4" />
      </Button>

      <EditMemberDialog member={member} open={editOpen} onOpenChange={setEditOpen} />
      <RemoveMemberDialog member={member} open={removeOpen} onOpenChange={setRemoveOpen} />
    </div>
  );
}

function EditMemberDialog({
  member,
  open,
  onOpenChange,
}: {
  member: CrewMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [role, setRole] = useState(member.role);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const emailLocked = member.loginStatus === "active";

  function handleOpenChange(next: boolean) {
    if (next) {
      setRole(member.role);
      setError(null);
    }
    onOpenChange(next);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await updateEmployee(member.id, {
        firstName: String(form.get("firstName") ?? ""),
        lastName: String(form.get("lastName") ?? ""),
        email: emailLocked ? member.email : String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        position: String(form.get("position") ?? ""),
        crewId: String(form.get("crewId") ?? ""),
        role,
      });
      if ("error" in result && result.error) setError(result.error);
      else onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit crew member</DialogTitle>
          <DialogDescription>Fix spelling, contact info, crew, or role.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`first-${member.id}`}>First name</Label>
              <Input
                id={`first-${member.id}`}
                name="firstName"
                defaultValue={member.firstName}
                required
                autoComplete="off"
                className="text-base md:text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`last-${member.id}`}>Last name</Label>
              <Input
                id={`last-${member.id}`}
                name="lastName"
                defaultValue={member.lastName}
                required
                autoComplete="off"
                className="text-base md:text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`email-${member.id}`}>Email</Label>
            <Input
              id={`email-${member.id}`}
              name="email"
              type="email"
              defaultValue={member.email}
              required
              disabled={emailLocked}
              className="text-base md:text-sm"
            />
            {emailLocked && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                This is their sign-in email, so it can&apos;t be changed here.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`phone-${member.id}`}>Phone</Label>
              <Input
                id={`phone-${member.id}`}
                name="phone"
                type="tel"
                defaultValue={member.phone}
                className="text-base md:text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`crew-${member.id}`}>Crew</Label>
              <CrewSelect id={`crew-${member.id}`} name="crewId" defaultValue={member.crewId} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`position-${member.id}`}>Position / title</Label>
            <Input
              id={`position-${member.id}`}
              name="position"
              defaultValue={member.position}
              placeholder="Installer, Crew Lead..."
              className="text-base md:text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Role / access level</Label>
            <Select value={role} onValueChange={(v) => setRole(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a role..." />
              </SelectTrigger>
              <SelectContent>
                {CREW_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="h-11" disabled={isPending || !role}>
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemoveMemberDialog({
  member,
  open,
  onOpenChange,
}: {
  member: CrewMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeEmployee(member.id);
      if ("error" in result && result.error) setError(result.error);
      else onOpenChange(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove {member.name}?</DialogTitle>
          <DialogDescription className="leading-relaxed">
            {member.loginStatus === "active"
              ? "They'll lose access to your business right away, including customers, jobs, photos, and documents."
              : "Their pending invite will be cancelled, so the link in their email won't give them access."}{" "}
            Past jobs they worked on will still show their name.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" className="h-11" disabled={isPending} onClick={handleRemove}>
            {isPending ? "Removing..." : "Remove employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
