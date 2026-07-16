'use client';

import { useState } from 'react';
import { Copy, RotateCcw, Link as LinkIcon, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getOrCreatePortalToken, regeneratePortalToken } from '@/app/(crm)/customers/portal-actions';

interface CustomerPortalAccessProps {
  customerId: string;
  customerName: string;
  customerEmail?: string;
}

export function CustomerPortalAccess({
  customerId,
  customerName,
  customerEmail,
}: CustomerPortalAccessProps) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGetToken = async () => {
    setLoading(true);
    try {
      const newToken = await getOrCreatePortalToken(customerId);
      setToken(newToken);
    } catch (error) {
      console.error('Failed to get portal token:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!confirm('Are you sure? The old link will stop working.')) {
      return;
    }

    setLoading(true);
    try {
      const newToken = await regeneratePortalToken(customerId);
      setToken(newToken);
    } catch (error) {
      console.error('Failed to regenerate token:', error);
    } finally {
      setLoading(false);
    }
  };

  const portalUrl = token ? `${window.location.origin}/customer-portal/${token}` : '';

  const handleCopy = () => {
    if (portalUrl) {
      navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendEmail = async () => {
    if (!portalUrl || !customerEmail) return;

    try {
      await fetch('/api/send-portal-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: customerEmail,
          customerName,
          portalUrl,
        }),
      });
      alert('Portal invitation sent to ' + customerEmail);
    } catch (error) {
      alert('Failed to send email');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" size="sm">
          <LinkIcon className="w-4 h-4 mr-2" />
          Portal Access
        </Button>
      } />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customer Portal Access</DialogTitle>
          <DialogDescription>
            Generate and share a secure link for {customerName} to access their portal
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!token ? (
            <Button onClick={handleGetToken} disabled={loading} className="w-full">
              {loading ? 'Generating...' : 'Generate Portal Link'}
            </Button>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Portal URL</label>
                <div className="flex gap-2">
                  <Input value={portalUrl} readOnly className="text-xs" />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleCopy}
                    title={copied ? 'Copied!' : 'Copy'}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                {copied && <p className="text-xs text-green-600">Copied to clipboard!</p>}
              </div>

              <div className="pt-2 space-y-2">
                {customerEmail && (
                  <Button
                    onClick={handleSendEmail}
                    variant="secondary"
                    className="w-full"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Send Portal Link to {customerEmail}
                  </Button>
                )}

                <Button
                  onClick={handleRegenerate}
                  variant="ghost"
                  disabled={loading}
                  className="w-full text-destructive hover:text-destructive"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Regenerate Link
                </Button>
              </div>

              <p className="text-xs text-muted-foreground pt-2">
                This link never expires. Anyone with the link can access the portal.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
