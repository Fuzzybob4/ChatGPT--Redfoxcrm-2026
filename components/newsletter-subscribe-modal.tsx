'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

interface NewsletterSubscribeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewsletterSubscribeModal({ open, onOpenChange }: NewsletterSubscribeModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // TODO: Replace with actual newsletter API endpoint
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSubmitted(true);
        setFormData({ email: '', firstName: '', lastName: '' });
        setTimeout(() => {
          onOpenChange(false);
          setSubmitted(false);
        }, 2000);
      }
    } catch (error) {
      console.error('Subscribe error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[#0f0f0f] border border-white/10 rounded-lg max-w-md w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white">Stay Updated</h2>
            <button
              onClick={() => onOpenChange(false)}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {submitted ? (
              <div className="text-center">
                <p className="text-green-500 font-medium mb-2">✓ Successfully subscribed!</p>
                <p className="text-sm text-gray-400">Check your email for updates and exclusive content.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-400 mb-6">
                  Get tips, updates, and industry insights delivered to your inbox.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="text"
                      placeholder="First name"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      required
                      className="h-10 text-sm"
                    />
                    <Input
                      type="text"
                      placeholder="Last name"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      required
                      className="h-10 text-sm"
                    />
                  </div>

                  <Input
                    type="email"
                    placeholder="Email address"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="h-10 text-sm"
                  />

                  <Button
                    type="submit"
                    variant="default"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? 'Subscribing...' : 'Subscribe'}
                  </Button>
                </form>

                <p className="text-xs text-gray-500 mt-4 text-center">
                  We respect your privacy. Unsubscribe anytime.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
