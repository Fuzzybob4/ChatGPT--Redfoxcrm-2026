'use client';

import { useEffect, useState } from 'react';
import { Copy, Mail, RotateCcw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getOrCreatePortalToken, regeneratePortalToken } from '@/app/(crm)/customers/portal-actions';

interface CustomerPortalLinkCardProps {
  customerId: string;
  customerName: string;
  customerEmail?: string;
}

export function CustomerPortalLinkCard({
  customerId,
  customerName,
  customerEmail,
}: CustomerPortalLinkCardProps) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadPortalToken();
  }, [customerId]);

  const loadPortalToken = async () => {
    setLoading(true);
    try {
      const newToken = await getOrCreatePortalToken(customerId);
      setToken(newToken);
    } catch (error) {
      console.error('Failed to load portal token:', error);
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

  const handleRegenerate = async () => {
    if (!confirm('Are you sure? The old link will stop working.')) {
      return;
    }

    setLoading(true);
    try {
      const newToken = await regeneratePortalToken(customerId);
      setToken(newToken);
      setCopied(false);
    } catch (error) {
      console.error('Failed to regenerate token:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!portalUrl || !customerEmail) return;

    setSending(true);
    try {
      const response = await fetch('/api/send-portal-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: customerEmail,
          customerName,
          portalUrl,
        }),
      });

      if (response.ok) {
        alert(`Portal link sent to ${customerEmail}`);
      } else {
        alert('Failed to send email');
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      alert('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer Portal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Customer Portal</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Share this link for {customerName} to access the portal
            </p>
          </div>
          <Badge variant="secondary">Ready to Share</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Portal Link</label>
          <div className="flex gap-2">
            <Input
              value={portalUrl}
              readOnly
              className="text-xs font-mono"
            />
            <Button
              size="icon"
              variant="outline"
              onClick={handleCopy}
              title={copied ? 'Copied!' : 'Copy to clipboard'}
              className="shrink-0"
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => window.open(portalUrl, '_blank')}
              title="Open in new tab"
              className="shrink-0"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
          {copied && (
            <p className="text-xs text-green-600 font-medium">✓ Copied to clipboard</p>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          {customerEmail && (
            <Button
              onClick={handleSendEmail}
              disabled={sending}
              size="sm"
              variant="secondary"
              className="flex-1"
            >
              <Mail className="w-3.5 h-3.5 mr-1.5" />
              {sending ? 'Sending...' : 'Send via Email'}
            </Button>
          )}
          <Button
            onClick={handleRegenerate}
            disabled={loading}
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            title="Generate a new link (old one will expire)"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Regenerate
          </Button>
        </div>

        <p className="text-xs text-muted-foreground pt-1">
          This link never expires. Regenerate to invalidate the previous link.
        </p>
      </CardContent>
    </Card>
  );
}
