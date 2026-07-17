'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Plus, Edit2, Trash2, Check } from 'lucide-react';
import { getTaxSettings, createTaxSetting, updateTaxSetting, deleteTaxSetting } from '@/app/(crm)/invoices/billing-actions';
import { useLocation } from '@/lib/location-context';

interface TaxSetting {
  id: string;
  tax_name: string;
  tax_rate: number;
  description: string | null;
  is_default: boolean;
}

export default function TaxSettingsPage() {
  const { selectedLocationId } = useLocation();
  const [taxSettings, setTaxSettings] = useState<TaxSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    taxName: '',
    taxRate: '',
    description: '',
    isDefault: false,
  });

  // Load tax settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        const settings = await getTaxSettings(selectedLocationId);
        setTaxSettings(settings || []);
      } catch (error) {
        console.error('[v0] Failed to load tax settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (selectedLocationId) {
      loadSettings();
    }
  }, [selectedLocationId]);

  const resetForm = () => {
    setFormData({ taxName: '', taxRate: '', description: '', isDefault: false });
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!formData.taxName || !formData.taxRate) {
      alert('Tax name and rate are required');
      return;
    }

    setIsSaving(true);
    try {
      const rate = parseFloat(formData.taxRate);
      
      if (editingId) {
        await updateTaxSetting(editingId, {
          tax_name: formData.taxName,
          tax_rate: rate,
          description: formData.description || null,
          is_default: formData.isDefault,
        });
      } else {
        await createTaxSetting(
          selectedLocationId,
          formData.taxName,
          rate,
          formData.description || undefined,
          formData.isDefault
        );
      }

      // Reload settings
      const settings = await getTaxSettings(selectedLocationId);
      setTaxSettings(settings || []);
      resetForm();
      setShowForm(false);
    } catch (error) {
      alert(`Failed to save tax setting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tax setting?')) return;

    try {
      await deleteTaxSetting(id);
      setTaxSettings(taxSettings.filter((s) => s.id !== id));
    } catch (error) {
      alert(`Failed to delete tax setting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleEdit = (setting: TaxSetting) => {
    setFormData({
      taxName: setting.tax_name,
      taxRate: setting.tax_rate.toString(),
      description: setting.description || '',
      isDefault: setting.is_default,
    });
    setEditingId(setting.id);
    setShowForm(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader 
        title="Tax Settings"
        subtitle="Manage tax rates for your invoices"
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-4xl">
        <div className="space-y-6">
          {/* Add New Tax Button */}
          {!showForm && (
            <Button 
              onClick={() => setShowForm(true)}
              className="gap-2"
            >
              <Plus className="size-4" />
              Add Tax Rate
            </Button>
          )}

          {/* Add/Edit Form */}
          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>{editingId ? 'Edit' : 'Add'} Tax Rate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Tax Name *</label>
                  <Input
                    placeholder="e.g., Sales Tax, VAT"
                    value={formData.taxName}
                    onChange={(e) => setFormData({ ...formData, taxName: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Tax Rate (%) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="8.5"
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="Add optional description..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.currentTarget.checked })}
                  />
                  <label className="text-sm font-medium">Set as default tax</label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="gap-2"
                  >
                    {isSaving ? 'Saving...' : 'Save Tax Rate'}
                  </Button>
                  <Button
                    onClick={() => {
                      resetForm();
                      setShowForm(false);
                    }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tax Settings List */}
          <Card>
            <CardHeader>
              <CardTitle>Tax Rates</CardTitle>
              <CardDescription>Manage your organization&apos;s tax rates</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : taxSettings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No tax rates configured yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tax Name</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Default</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {taxSettings.map((setting) => (
                        <TableRow key={setting.id}>
                          <TableCell className="font-medium">{setting.tax_name}</TableCell>
                          <TableCell>{setting.tax_rate}%</TableCell>
                          <TableCell>
                            {setting.is_default ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <Check className="size-4" />
                                Yes
                              </div>
                            ) : (
                              <span className="text-muted-foreground">No</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleEdit(setting)}
                                size="sm"
                                variant="ghost"
                              >
                                <Edit2 className="size-4" />
                              </Button>
                              <Button
                                onClick={() => handleDelete(setting.id)}
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
