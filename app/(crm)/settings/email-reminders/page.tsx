'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Bell, Save } from 'lucide-react';
import { getEmailReminderSettings, updateEmailReminderSettings } from '@/app/(crm)/invoices/billing-actions';
import { useLocation } from '@/lib/location-context';

interface ReminderSettings {
  reminderType: 'invoice_due' | 'payment_received' | 'overdue';
  enabled: boolean;
  intervals: number[];
}

export default function EmailRemindersPage() {
  const { selectedLocationId } = useLocation();
  const [settings, setSettings] = useState<ReminderSettings[]>([
    { reminderType: 'invoice_due', enabled: true, intervals: [2, 7] },
    { reminderType: 'payment_received', enabled: false, intervals: [] },
    { reminderType: 'overdue', enabled: true, intervals: [3, 7] },
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load email reminder settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        const dbSettings = await getEmailReminderSettings(selectedLocationId);
        if (dbSettings && dbSettings.length > 0) {
          const parsed = dbSettings.map((s: any) => ({
            reminderType: s.reminder_type,
            enabled: s.enabled,
            intervals: JSON.parse(s.reminder_intervals || '[]'),
          }));
          setSettings(parsed);
        }
      } catch (error) {
        console.error('[v0] Failed to load email reminder settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (selectedLocationId) {
      loadSettings();
    }
  }, [selectedLocationId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const setting of settings) {
        await updateEmailReminderSettings(
          selectedLocationId,
          setting.reminderType,
          setting.enabled,
          setting.intervals
        );
      }
      alert('Email reminder settings saved successfully!');
    } catch (error) {
      alert(`Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = (reminderType: string, field: string, value: any) => {
    setSettings(
      settings.map((s) =>
        s.reminderType === reminderType ? { ...s, [field]: value } : s
      )
    );
  };

  const toggleInterval = (reminderType: string, day: number) => {
    setSettings(
      settings.map((s) => {
        if (s.reminderType === reminderType) {
          const intervals = s.intervals.includes(day)
            ? s.intervals.filter((d) => d !== day)
            : [...s.intervals, day].sort((a, b) => a - b);
          return { ...s, intervals };
        }
        return s;
      })
    );
  };

  const reminderTypeLabels: Record<string, { label: string; description: string }> = {
    invoice_due: {
      label: 'Payment Due Reminder',
      description: 'Send reminders to customers about upcoming invoice payments',
    },
    payment_received: {
      label: 'Payment Received Notification',
      description: 'Notify customers when payment is received',
    },
    overdue: {
      label: 'Overdue Notice',
      description: 'Send escalating notices for overdue invoices',
    },
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader 
        title="Email Reminders"
        subtitle="Configure automatic email reminders for invoices"
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-4xl">
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              {settings.map((setting) => {
                const config = reminderTypeLabels[setting.reminderType];
                return (
                  <Card key={setting.reminderType}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 p-2 rounded-lg bg-primary/10">
                            <Bell className="size-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle>{config.label}</CardTitle>
                            <CardDescription>{config.description}</CardDescription>
                          </div>
                        </div>
                        <Checkbox
                          checked={setting.enabled}
                          onChange={(e) =>
                            updateSetting(setting.reminderType, 'enabled', e.currentTarget.checked)
                          }
                        />
                      </div>
                    </CardHeader>

                    {setting.enabled && (
                      <CardContent className="space-y-4">
                        <div>
                          <label className="text-sm font-medium block mb-3">
                            Send reminder at these intervals (days after invoice):
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            {[1, 2, 3, 5, 7, 14].map((days) => (
                              <div key={days} className="flex items-center gap-2">
                                <Checkbox
                                  checked={setting.intervals.includes(days)}
                                  onChange={() => toggleInterval(setting.reminderType, days)}
                                />
                                <label className="text-sm text-foreground cursor-pointer">
                                  {days} day{days !== 1 ? 's' : ''}
                                </label>
                              </div>
                            ))}
                          </div>
                          {setting.intervals.length === 0 && (
                            <p className="text-sm text-muted-foreground mt-2">
                              At least one interval should be selected
                            </p>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}

              {/* Save Button */}
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="gap-2"
                >
                  <Save className="size-4" />
                  {isSaving ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>

              {/* Information Box */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                  <h4 className="font-semibold text-blue-900 mb-2">How it works:</h4>
                  <ul className="text-sm text-blue-900 space-y-1 list-disc list-inside">
                    <li>When an invoice is created, reminders are automatically scheduled</li>
                    <li>The system sends emails at the configured intervals</li>
                    <li>A cron job runs hourly to send pending reminders</li>
                    <li>Set up the cron endpoint: POST /api/cron/send-invoice-reminders</li>
                  </ul>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
