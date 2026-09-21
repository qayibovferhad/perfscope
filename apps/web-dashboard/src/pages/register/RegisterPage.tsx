import { useEffect, useState } from 'react';
import type { AuthResponse } from '@perfscope/shared';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { GoogleButton, googleAuthEnabled } from '@/features/auth';
import { Eye, EyeOff, Loader2, Lock, Mail, User } from 'lucide-react';
import { AuthCard } from '@/shared/ui/auth-card';
import { useAuthStore } from '@/features/auth';
import { apiClient } from '@/shared/api/client';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';


interface FormValues {
  name:     string;
  email:    string;
  password: string;
}

export function RegisterPage() {
  const { user, setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // An explicit ?redirect wins, exactly as it does on the login page — an invitation link
  // sends people here and has to get them back to it.
  const redirectTo = params.get('redirect') || '/dashboard';

  const [showPass,  setShowPass]  = useState(false);
  const [serverErr, setServerErr] = useState('');

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
      const res = await apiClient.post<AuthResponse>('/auth/register', data);
      setAuth(res.data.user, res.data.token, res.data.refreshToken);
      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Registration failed';
      setServerErr(msg);
    }
  }

  function onGoogleSuccess({ user, token, refreshToken }: AuthResponse) {
    setAuth(user, token, refreshToken);
    navigate(redirectTo, { replace: true });
  }

  return (
    // The shared signed-out shell — see LoginPage: this page carried its own copy.
    <AuthCard title="Create an account" subtitle="Create a new account">
        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <Input
              {...register('name', { required: 'Full name is required' })}
              placeholder="Full name"
              icon={<User />}
              error={!!errors.name}
            />
            {errors.name && (
              <span className="text-[11px] px-1 text-ps-regression">{errors.name.message}</span>
            )}
          </div>

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
            {isSubmitting ? <Loader2 className="animate-spin" /> : 'Create Account'}
          </Button>

          <p className="text-center text-xs text-ps-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-ps-accent">
              Sign in
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
