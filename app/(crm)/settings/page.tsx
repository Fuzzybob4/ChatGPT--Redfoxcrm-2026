import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Mail,
  Bell,
  Building,
  Zap,
} from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader
        title="Settings"
        description="Manage your account, integrations, and preferences"
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">

          {/* Business info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building className="size-4 text-primary" />
                Business Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="biz-name" className="text-xs font-medium">
                    Business Name
                  </Label>
                  <Input id="biz-name" defaultValue="RedFox Services LLC" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="biz-phone" className="text-xs font-medium">
                    Phone
                  </Label>
                  <Input id="biz-phone" defaultValue="(512) 555-0000" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-email" className="text-xs font-medium">
                  Business Email
                </Label>
                <Input id="biz-email" defaultValue="hello@redfoxservices.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-address" className="text-xs font-medium">
                  Address
                </Label>
                <Input id="biz-address" defaultValue="123 Main St, Austin TX 78701" />
              </div>
              <Button size="sm">Save Changes</Button>
            </CardContent>
          </Card>

          {/* Integrations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="size-4 text-primary" />
                Integrations
              </CardTitle>
              <CardDescription className="text-xs">
                Connect your payments, email, and notification providers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-border">
              {[
                {
                  name: "Stripe",
                  description: "Accept online payments from customers",
                  icon: CreditCard,
                  connected: false,
                },
                {
                  name: "Resend",
                  description: "Send invoice emails and reminders",
                  icon: Mail,
                  connected: false,
                },
                {
                  name: "Twilio",
                  description: "SMS notifications for job reminders",
                  icon: Bell,
                  connected: false,
                },
              ].map((integration) => (
                <div
                  key={integration.name}
                  className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                      <integration.icon className="size-4 text-primary" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{integration.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {integration.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {integration.connected ? (
                      <Badge
                        variant="outline"
                        className="text-emerald-700 border-emerald-200 bg-emerald-50 text-xs"
                      >
                        Connected
                      </Badge>
                    ) : (
                      <Button variant="outline" size="sm">
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Danger zone */}
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-destructive">
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Delete Account</p>
                  <p className="text-xs text-muted-foreground">
                    Permanently delete your CRM account and all data
                  </p>
                </div>
                <Button variant="destructive" size="sm">
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
