'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { deleteEstimate, setEstimateArchived } from '@/app/(crm)/estimates/manage-actions';

/** Archive / restore / delete for one estimate (header buttons). */
export function EstimateManageButtons({
  estimateId,
  archived,
  hasInvoice,
  onChanged,
}: {
  estimateId: string;
  archived: boolean;
  hasInvoice: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: 'archive' | 'restore' | 'delete') {
    setBusy(true);
    setError(null);
    const res =
      kind === 'delete' ? await deleteEstimate(estimateId) : await setEstimateArchived(estimateId, kind === 'archive');
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setConfirm(null);
    await onChanged();
    if (kind !== 'restore') router.push('/estimates');
  }

  return (
    <>
      {archived ? (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void run('restore')}>
          <ArchiveRestore className="w-4 h-4 mr-2" />
          Restore
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirm('archive')}>
          <Archive className="w-4 h-4 mr-2" />
          Archive
        </Button>
      )}
      {!hasInvoice && (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          disabled={busy}
          onClick={() => setConfirm('delete')}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </Button>
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === 'delete' ? 'Delete this estimate?' : 'Archive this estimate?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'delete'
                ? "It's removed for good, along with its pictures. The customer's link stops working. This can't be undone."
                : "It's hidden from your estimates and the customer's link stops working. You can restore it any time from the Archived filter."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className={confirm === 'delete' ? 'bg-destructive text-white hover:bg-destructive/90' : undefined}
              onClick={(e) => {
                e.preventDefault();
                void run(confirm === 'delete' ? 'delete' : 'archive');
              }}
            >
              {busy ? 'Working…' : confirm === 'delete' ? 'Delete' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
