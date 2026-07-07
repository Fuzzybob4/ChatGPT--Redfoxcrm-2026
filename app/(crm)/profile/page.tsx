'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useOrgContext } from '@/lib/org-context';

export default function ProfilePage() {
  const org = useOrgContext();
  const [formData, setFormData] = useState({
    businessName: org.businessName,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSave = async () => {
    // TODO: Implement save to database
    alert('Profile update not yet implemented');
  };

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader
        title="Profile"
        description="Manage your business profile and account information"
      />

      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          {/* Business Information */}
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
              <CardDescription>
                Update your business profile details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  name="businessName"
                  value={formData.businessName}
                  onChange={handleChange}
                  placeholder="Enter business name"
                />
              </div>

              <Button onClick={handleSave}>
                Save Changes
              </Button>
            </CardContent>
          </Card>

          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Organization and plan details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Organization ID</p>
                  <p className="text-sm font-mono">{org.orgId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Plan</p>
                  <p className="text-sm font-medium">
                    {org.isEnterprise ? 'Enterprise' : org.locationCount > 1 ? 'Professional' : 'Starter'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Locations</p>
                  <p className="text-sm font-medium">{org.locationCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
