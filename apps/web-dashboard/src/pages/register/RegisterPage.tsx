import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { GoogleButton } from '@/features/auth/ui/GoogleButton';
import { motion } from 'framer-motion';
import { Activity, Eye, EyeOff, Loader2, Lock, Mail, User } from 'lucide-react';
import { useAuthStore } from '@/features/auth/model/authStore';
import type { AuthUser } from '@/entities/user';
import { apiClient } from '@/shared/api/client';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';


interface FormValues {
  name:     string;
  email:    string;
  password: string;
}

export function RegisterPage() {
  const { user, setAuth, setUser } = useAuthStore();
  const navigate = useNavigate();

  const [showPass,  setShowPass]  = useState(false);
  const [serverErr, setServerErr] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  useEffect(() => {
    if (user) navigate('/app', { replace: true });
  }, [user, navigate]);

  async function onSubmit(data: FormValues) {
    setServerErr('');
    try {
      const res = await apiClient.post<{ token: string; user: AuthUser }>('/auth/register', data);
      setAuth(res.data.user, res.data.token);
      navigate('/app', { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Registration failed';
      setServerErr(msg);
    }
  }

  function onGoogleSuccess(user: AuthUser) {
    setUser(user);
    navigate('/app', { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-ps-page">
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full blur-[130px] bg-[image:var(--ps-blob-tl)]" />
      <div className="pointer-events-none absolute right-0 top-0 w-[350px] h-[350px] rounded-full blur-[120px] bg-[image:var(--ps-blob-br)]" />

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
            <p className="text-xs mt-1 text-ps-muted">Create a new account</p>
          </div>
        </div>

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
            <div className="relative">
              <Input
                {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 characters' } })}
                type={showPass ? 'text' : 'password'}
                placeholder="Password"
                icon={<Lock />}
                error={!!errors.password}
                className="pr-7"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-[14px] top-1/2 -translate-y-1/2 text-ps-muted hover:text-ps-heading transition-colors"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
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

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-ps-divider" />
          <span className="text-xs text-ps-muted">or</span>
          <div className="flex-1 h-px bg-ps-divider" />
        </div>

        <GoogleButton onSuccess={onGoogleSuccess} onError={(msg) => setServerErr(msg)} />
      </motion.div>
    </div>
  );
}
