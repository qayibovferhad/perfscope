import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { apiClient } from '@/shared/api/client';
import { AuthCard } from '@/shared/ui/auth-card';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';

interface FormValues { password: string; confirm: string }

/**
 * The other half of the reset: the page the emailed link opens.
 *
 * The token lives in the query string, which is where an emailed link can put it. It is
 * spent by the request, so this page works exactly once — a second visit gets the same
 * "invalid or expired" the server gives every bad token, with no hint about which kind of
 * bad it was.
 *
 * Success sends the reader to the login form rather than signing them in: the reset ends
 * *every* session by design, and signing them in here would immediately mint a new one and
 * quietly undo half of that.
 */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();

  const [showPass, setShowPass] = useState(false);
  const [serverErr, setServerErr] = useState('');
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormValues>();
  // react-hook-form keeps field values outside React on purpose, so `watch` cannot be
  // memoized; that is the library's design, not something to work around here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const password = watch('password');

  async function onSubmit({ password: next }: FormValues) {
    setServerErr('');
    try {
      await apiClient.post('/auth/reset-password', { token, password: next });
      navigate('/login?reason=reset', { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setServerErr(msg ?? 'Could not set your password. Request a new link and try again.');
    }
  }

  if (!token) {
    return (
      <AuthCard title="Set a new password" subtitle="This link is incomplete">
        <p className="text-[13px] leading-relaxed text-ps-muted">
          That link is missing its token — mail clients sometimes cut long URLs in half. Ask
          for a new one and open it in a single click.
        </p>
        <Link to="/forgot-password" className="text-center text-xs font-semibold text-ps-accent">
          Request a new link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set a new password" subtitle="Choose a new password">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Input
            {...register('password', {
              required:  'Password is required',
              minLength: { value: 6, message: 'Min 6 characters' },
            })}
            type={showPass ? 'text' : 'password'}
            placeholder="New password"
            icon={<KeyRound />}
            error={!!errors.password}
            autoComplete="new-password"
            autoFocus
            trailing={
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
                className="text-ps-muted hover:text-ps-heading transition-colors"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
          {errors.password && (
            <span className="text-[11px] px-1 text-ps-regression">{errors.password.message}</span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Input
            {...register('confirm', {
              required: 'Please repeat the password',
              validate: v => v === password || 'Passwords do not match',
            })}
            type="password"
            placeholder="Repeat new password"
            icon={<KeyRound />}
            error={!!errors.confirm}
            autoComplete="new-password"
          />
          {errors.confirm && (
            <span className="text-[11px] px-1 text-ps-regression">{errors.confirm.message}</span>
          )}
        </div>

        {serverErr && <p className="text-xs px-3 py-2 rounded-lg ps-badge-reg">{serverErr}</p>}

        <Button type="submit" disabled={isSubmitting} className="w-full mt-1">
          {isSubmitting ? <Loader2 className="animate-spin" /> : 'Set new password'}
        </Button>

        <p className="text-center text-[11.5px] leading-relaxed text-ps-muted">
          Every device signed in to this account will be signed out.
        </p>
      </form>
    </AuthCard>
  );
}
