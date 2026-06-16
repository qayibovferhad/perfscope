import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Route } from 'lucide-react';
import { Modal }       from '@/shared/ui/modal/Modal';
import { ModalHeader } from '@/shared/ui/modal/ModalHeader';
import { Button }      from '@/shared/ui/button';
import { Input }       from '@/shared/ui/input';

export function NewAuditModal({
  open, baseUrl, projectId, onClose,
}: {
  open: boolean; baseUrl: string; projectId: string; onClose: () => void;
}) {
  const navigate = useNavigate();
  const [route, setRoute] = useState('/');

  const trimmed   = route.trim() || '/';
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const fullUrl   = baseUrl.replace(/\/$/, '') + withSlash;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onClose();
    navigate(`/app?url=${encodeURIComponent(fullUrl)}&projectId=${projectId}`);
  }

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader
        icon={<Activity className="w-[22px] h-[22px] text-ld-grad-text" />}
        title="New Audit"
        subtitle="Choose a route to audit on this project"
      />

      <form onSubmit={handleSubmit} className="mt-[22px] space-y-[14px]">
        <div className="space-y-[6px]">
          <label className="text-[11.5px] font-semibold uppercase tracking-[.1em] text-ld-text-3">
            Route Path
          </label>
          <Input
            icon={<Route />}
            mono
            value={route}
            onChange={(e) => setRoute(e.target.value)}
            placeholder="/dashboard"
            autoFocus
          />
        </div>

        <div className="px-[14px] py-[11px] rounded-[11px] bg-ld-accent-soft border border-ld-accent-line">
          <p className="text-[10.5px] font-bold uppercase tracking-[.1em] text-ld-accent mb-[4px]">
            Will analyze
          </p>
          <p className="text-[13px] font-mono break-all text-ld-text-2">
            {fullUrl}
          </p>
        </div>

        <Button type="submit" className="w-full mt-[4px]">
          <Activity /> Start Audit
        </Button>
      </form>
    </Modal>
  );
}
