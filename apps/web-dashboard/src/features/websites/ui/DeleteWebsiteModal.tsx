import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Modal, ModalHeader } from '@/shared/ui/modal';
import { Button } from '@/shared/ui/button';
import { getHostname } from '@/entities/website';

interface Props {
  open:       boolean;
  /** Site being removed — `null` while the modal is closed. */
  name?:      string;
  url:        string;
  isPending?: boolean;
  onConfirm:  () => void;
  onClose:    () => void;
}

export function DeleteWebsiteModal({ open, name, url, isPending, onConfirm, onClose }: Props) {
  const hostname = getHostname(url);

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader
        tone="danger"
        icon={<AlertTriangle className="w-[23px] h-[23px] text-white" />}
        title="Remove this website?"
        subtitle="This cannot be undone."
      />

      <div className="flex flex-col gap-[18px] mt-[18px]">
        <div className="flex flex-col gap-[3px] p-4 rounded-[13px] border border-ld-border bg-ld-surface-2">
          <b className="text-[14px] font-semibold text-ld-text truncate">{name || hostname}</b>
          <span className="font-mono text-[12.5px] text-ld-text-3 truncate">{hostname}</span>
        </div>

        <p className="text-[13px] text-ld-text-2 leading-[1.55]">
          The site, its saved login session and its automation schedule are removed.
          Past audits stay in your history.
        </p>

        <div className="flex gap-[10px]">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" className="flex-1" onClick={onConfirm} disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : <><Trash2 /> Remove</>}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
