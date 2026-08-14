import { useEffect, useState } from 'react';
import type { AuthResponse } from '@perfscope/shared';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { GoogleButton, googleAuthEnabled } from '@/features/auth';
import { motion } from 'framer-motion';
import { Activity, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
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
      setAuth(res.data.user, res.data.token);
      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Invalid credentials';
      setServerErr(msg);
    }
  }

  function onGoogleSuccess({ user, token }: AuthResponse) {
    setAuth(user, token);
    navigate(redirectTo, { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-ps-page">
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full blur-[130px] bg-[image:var(--ld-blob-tl)]" />
      <div className="pointer-events-none absolute right-0 top-0 w-[350px] h-[350px] rounded-full blur-[120px] bg-[image:var(--ld-blob-br)]" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="ps-panel relative z-10 flex flex-col gap-6 p-8 w-full max-w-[400px]"
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-2.5">
          <Link to="/">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[image:var(--ld-grad)] shadow-glow-accent-lg">
              <Activity className="w-5 h-5 text-white" />
            </div>
          </Link>
          <div className="text-center">
            <h1 className="text-xl font-extrabold tracking-tight leading-none font-mono">
              <span className="text-ps-heading">Perf</span>
              <span className="ps-gradient-text">Scope</span>
            </h1>
            <p className="text-xs mt-1 text-ps-muted">Sign in to your account</p>
          </div>
        </div>

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
      </motion.div>
    </div>
  );
}
