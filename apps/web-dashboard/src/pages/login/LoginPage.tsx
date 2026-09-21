import { useEffect, useState } from 'react';
import type { AuthResponse } from '@perfscope/shared';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { GoogleButton, googleAuthEnabled } from '@/features/auth';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { AuthCard } from '@/shared/ui/auth-card';
import { useAuthStore } from '@/features/auth';
import { apiClient } from '@/shared/api/client';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';


interface FormValues {
  email:    string;
  password: string;
}

export function LoginPage() {
  const { user, setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // The dashboard answers "what changed?"; the analyzer answers "audit this URL".
  // An explicit ?redirect (a shared report, a deep link) still wins.
  const redirectTo = params.get('redirect') || '/dashboard';

  // Set by the 401 interceptor when a stored token stops working mid-session.
  const reason = params.get('reason');
  const sessionNotice =
    reason === 'expired' ? 'Your session expired. Please sign in again.'
    : reason === 'invalid' ? 'Your session is no longer valid. Please sign in again.'
    // A reset signs every device out, this one included — so landing here is the expected
    // end of that flow, not a failure, and the wording has to say so.
    : reason === 'reset' ? 'Your password has been changed. Sign in with the new one.'
    : '';

  const [showPass,   setShowPass]   = useState(false);
  const [serverErr,  setServerErr]  = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [user, navigate, redirectTo]);

  async function onSubmit(data: FormValues) {
    setServerErr('');
    try {
      const res = await apiClient.post<AuthResponse>('/auth/login', data);
      setAuth(res.data.user, res.data.token, res.data.refreshToken);
      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Invalid credentials';
      setServerErr(msg);
    }
  }

  function onGoogleSuccess({ user, token, refreshToken }: AuthResponse) {
    setAuth(user, token, refreshToken);
    navigate(redirectTo, { replace: true });
  }

  return (
    // The shared signed-out shell. Login and register each carried their own copy of it —
    // the blobs, the panel, the logo block, the fade — which is how two of the four
    // signed-out pages ended up drifting from the other two.
    <AuthCard title="Sign in" subtitle="Sign in to your account">
        {/* Expired / invalidated session */}
        {sessionNotice && (
          <p className="text-xs px-3 py-2 rounded-lg mb-3 ps-badge-amber">{sessionNotice}</p>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          {/* Email */}
          <div className="flex flex-col gap-1">
            <Input
              {...register('email', {
                required: 'Email is required',
                pattern:  { value: /^\S+@\S+\.\S+$/, message: 'Invalid email' },
              })}
              type="email"
              placeholder="Email address"
              icon={<Mail />}
              error={!!errors.email}
            />
            {errors.email && (
              <span className="text-[11px] px-1 text-ps-regression">{errors.email.message}</span>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <Input
              {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 characters' } })}
              type={showPass ? 'text' : 'password'}
              placeholder="Password"
              icon={<Lock />}
              error={!!errors.password}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
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

          {/* Server error */}
          {serverErr && (
            <p className="text-xs px-3 py-2 rounded-lg ps-badge-reg">{serverErr}</p>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full mt-1">
            {isSubmitting ? <Loader2 className="animate-spin" /> : 'Sign In'}
          </Button>

          <p className="text-center text-xs text-ps-muted">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-ps-accent">
              Register
            </Link>
          </p>

          <p className="text-center text-xs text-ps-muted">
            <Link to="/forgot-password" className="font-semibold text-ps-accent">
              Forgot your password?
            </Link>
          </p>
        </form>

        {googleAuthEnabled && (
          <>
            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-ps-divider" />
              <span className="text-xs text-ps-muted">or</span>
              <div className="flex-1 h-px bg-ps-divider" />
            </div>

            <GoogleButton onSuccess={onGoogleSuccess} onError={(msg) => setServerErr(msg)} />
          </>
        )}
    </AuthCard>
  );
}
