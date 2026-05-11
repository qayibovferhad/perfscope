import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Globe, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { useWebsites } from './useWebsites';

interface WebsiteForm { url: string; name: string }

const inputStyle: React.CSSProperties = {
  background:   'var(--ps-accent-muted)',
  border:       '1px solid var(--ps-panel-border)',
  borderRadius: '0.75rem',
  color:        'var(--ps-text-heading)',
  fontFamily:   'var(--ps-font-sans)',
  fontSize:     '0.875rem',
  outline:      'none',
  width:        '100%',
  padding:      '0.625rem 0.875rem',
  transition:   'border-color 0.15s, box-shadow 0.15s',
};

function iFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = 'var(--ps-accent-border)';
  e.target.style.boxShadow   = '0 0 0 3px var(--ps-accent-muted)';
}
function iBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = 'var(--ps-panel-border)';
  e.target.style.boxShadow   = 'none';
}

interface Props {
  open:    boolean;
  onClose: () => void;
}

export function AddWebsiteModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { add }  = useWebsites();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<WebsiteForm>();

  async function onSubmit({ url, name }: WebsiteForm) {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    await add.mutateAsync({ url: normalized, name });
    reset();
    onClose();
    navigate(`/app?url=${encodeURIComponent(normalized)}`);
  }

  function handleOpenChange(open: boolean) {
    if (!open) { reset(); onClose(); }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        style={{
          background:           'var(--ps-panel-bg)',
          backdropFilter:       'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border:               '1px solid var(--ps-panel-border)',
          borderRadius:         '1.25rem',
          maxWidth:             440,
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--ps-accent-muted)', border: '1px solid var(--ps-accent-border)' }}
            >
              <Globe className="w-3.5 h-3.5" style={{ color: 'var(--ps-accent)' }} />
            </div>
            <div>
              <DialogTitle style={{ color: 'var(--ps-text-heading)', fontSize: '0.875rem' }}>
                Add Website
              </DialogTitle>
              <DialogDescription style={{ color: 'var(--ps-text-muted)', fontSize: '0.6875rem' }}>
                Save and start a Lighthouse audit
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-1">
          {/* Site name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--ps-text-secondary)' }}>
              Site name <span style={{ color: 'var(--ps-text-muted)' }}>(optional)</span>
            </label>
            <input
              {...register('name')}
              style={inputStyle}
              placeholder="My Portfolio"
              onFocus={iFocus} onBlur={iBlur}
            />
          </div>

          {/* URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--ps-text-secondary)' }}>
              Website URL
            </label>
            <div className="relative">
              <Globe
                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                style={{ color: 'var(--ps-text-muted)' }}
              />
              <input
                {...register('url', {
                  required: 'URL is required',
                  pattern:  { value: /^(https?:\/\/)?[\w-]+(\.[\w-]+)+/, message: 'Enter a valid URL' },
                })}
                style={{
                  ...inputStyle,
                  fontFamily: 'var(--ps-font-mono)',
                  fontSize:   '0.8rem',
                  padding:    '0.625rem 0.875rem 0.625rem 2.25rem',
                }}
                placeholder="https://example.com"
                onFocus={iFocus} onBlur={iBlur}
              />
            </div>
            {errors.url && (
              <span className="text-[11px] px-1" style={{ color: 'var(--ps-regression)' }}>
                {errors.url.message}
              </span>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              style={{
                background: 'var(--ps-accent-muted)',
                border:     '1px solid var(--ps-panel-border)',
                color:      'var(--ps-text-secondary)',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 ps-btn-primary flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
            >
              Start Audit <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
