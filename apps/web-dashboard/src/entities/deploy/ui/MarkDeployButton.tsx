import { useState } from 'react';
import { Rocket, Trash2 } from 'lucide-react';
import { deployLabel, type Deploy } from '@perfscope/shared';
import { Modal } from '@/shared/ui/modal/Modal';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { useDeploys } from '../model/useDeploys';

/** `datetime-local` wants a local ISO string with no zone and no seconds. */
function localNow(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

interface Props {
  /** The audited URL; the site it belongs to is resolved from it. */
  url: string;
}

/**
 * Record a release by hand, and unpick one recorded by mistake.
 *
 * The API exists for CI, which is where deploys should come from — but a feature only a
 * pipeline can reach is a feature most accounts never see working, and the way anyone
 * decides whether markers are worth wiring into CI is by putting one on the chart first.
 */
export function MarkDeployButton({ url }: Props) {
  const { deploys, websiteId, mark, remove } = useDeploys(url);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [ref, setRef] = useState('');
  const [at, setAt] = useState(localNow);

  // A URL nobody added as a site has nothing to hang a deploy on.
  if (!websiteId) return null;

  function submit() {
    mark.mutate(
      {
        at: new Date(at).toISOString(),
        ...(label.trim() ? { label: label.trim() } : {}),
        ...(ref.trim() ? { ref: ref.trim() } : {}),
      },
      { onSuccess: () => { setLabel(''); setRef(''); setAt(localNow()); } },
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-ld-text-3 hover:text-ld-accent transition-colors"
      >
        <Rocket className="w-3 h-3" />
        {deploys.length > 0 ? `${deploys.length} deploy${deploys.length === 1 ? '' : 's'}` : 'Mark deploy'}
      </button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="px-6 pt-6 pb-5">
          <p className="text-[15px] font-bold text-ld-text">Mark a deploy</p>
          <p className="text-[11px] text-ld-text-3 mt-1">
            It appears on the chart at the first run measured after it — the earliest audit that
            could have seen the change.
          </p>

          <div className="flex flex-col gap-2.5 mt-4">
            <Input
              value={label} onChange={e => setLabel(e.target.value)}
              placeholder="v2.4.0  or  hotfix: cart" className="h-9 text-xs"
            />
            <div className="flex gap-2">
              <Input
                value={ref} onChange={e => setRef(e.target.value)}
                placeholder="commit or build ref (optional)" className="h-9 text-xs font-mono flex-1"
              />
              <Input
                type="datetime-local" value={at} onChange={e => setAt(e.target.value)}
                className="h-9 text-xs font-mono w-[190px]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Button size="sm" onClick={submit} disabled={mark.isPending}>
              {mark.isPending ? 'Recording…' : 'Record deploy'}
            </Button>
            {mark.isError && <span className="text-[10px] text-ld-rose">Could not record that.</span>}
          </div>

          {deploys.length > 0 && (
            <div className="mt-5 pt-4 border-t border-ld-border">
              <p className="text-[9px] font-bold uppercase tracking-widest text-ld-text-3 mb-2">
                Recorded
              </p>
              <div className="flex flex-col max-h-[180px] overflow-y-auto">
                {deploys.map((d: Deploy) => (
                  <div key={d._id} className="flex items-center gap-2 py-1.5 border-b border-ld-border last:border-0">
                    <span className="flex-1 truncate text-[11px] font-mono font-semibold text-ld-text-2">
                      {deployLabel(d)}
                    </span>
                    <span className="text-[10px] font-mono text-ld-text-3 shrink-0">
                      {new Date(d.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <button
                      onClick={() => remove.mutate(d._id)}
                      className="w-5 h-5 rounded grid place-items-center text-ld-text-3 hover:text-ld-rose hover:bg-ld-rose/15"
                      aria-label={`Remove ${deployLabel(d)}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
