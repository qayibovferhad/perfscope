import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { ModalHeader } from './ModalHeader';
import { Button } from '@/shared/ui/button';

interface Props {
  open:          boolean;
  title:         string;
  subtitle?:     string;
  /** Optional detail block — e.g. the record being removed. */
  children?:     React.ReactNode;
  confirmLabel?: string;
  cancelLabel?:  string;
  confirmIcon?:  React.ReactNode;
  /** `danger` paints the icon tile and confirm button red. */
  tone?:         'accent' | 'danger';
  isPending?:    boolean;
  onConfirm:     () => void;
  onClose:       () => void;
}

/** Shared confirmation dialog so destructive actions never fall back to window.confirm. */
export function ConfirmModal({
  open, title, subtitle, children,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel', confirmIcon,
  tone = 'danger', isPending, onConfirm, onClose,
}: Props) {
  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader
        tone={tone}
        icon={<AlertTriangle className="w-[23px] h-[23px] text-white" />}
        title={title}
        {...(subtitle ? { subtitle } : {})}
      />

      <div className="flex flex-col gap-[18px] mt-[18px]">
        {children}

        <div className="flex gap-[10px]">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === 'danger' ? 'destructive' : 'default'}
            className="flex-1"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="animate-spin" /> : <>{confirmIcon}{confirmLabel}</>}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
