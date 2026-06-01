import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { GoogleButton } from '@/features/auth/GoogleButton';
import { motion } from 'framer-motion';
import { Activity, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/features/auth/model/authStore';
import type { AuthUser } from '@/entities/user';
import { apiClient } from '@/shared/api/client';


interface FormValues {
  name:     string;
  email:    string;
  password: string;
}

const inputBase: React.CSSProperties = {
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
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'var(--ps-page-bg)' }}
    >
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full blur-[130px]"
        style={{ background: 'var(--ps-blob-tl)' }} />
      <div className="pointer-events-none absolute right-0 top-0 w-[350px] h-[350px] rounded-full blur-[120px]"
        style={{ background: 'var(--ps-blob-br)' }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="ps-panel relative z-10 flex flex-col gap-6 p-8 w-full"
        style={{ maxWidth: 400 }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-2.5">
          <Link to="/">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 0 24px var(--ps-accent-glow)' }}>
              <Activity className="w-5 h-5 text-white" />
            </div>
          </Link>
          <div className="text-center">
            <h1 className="text-xl font-extrabold tracking-tight leading-none" style={{ fontFamily: 'var(--ps-font-mono)' }}>
              <span style={{ color: 'var(--ps-text-heading)' }}>Perf</span>
              <span style={{ background: 'linear-gradient(135deg,var(--ps-accent),#c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Scope</span>
            </h1>
            <p className="text-xs mt-1" style={{ color: 'var(--ps-text-muted)' }}>Create a new account</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <input
              {...register('name', { required: 'Full name is required' })}
              style={inputBase}
              placeholder="Full name"
              onFocus={(e) => { e.target.style.borderColor = 'var(--ps-accent-border)'; e.target.style.boxShadow = '0 0 0 3px var(--ps-accent-muted)'; }}
              onBlur={(e)  => { e.target.style.borderColor = 'var(--ps-panel-border)';  e.target.style.boxShadow = 'none'; }}
            />
            {errors.name && (
              <span className="text-[11px] px-1" style={{ color: 'var(--ps-regression)' }}>
                {errors.name.message}
              </span>
            )}
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <input
              {...register('email', {
                required: 'Email is required',
                pattern:  { value: /^\S+@\S+\.\S+$/, message: 'Invalid email' },
              })}
              style={inputBase}
              type="email"
              placeholder="Email address"
              onFocus={(e) => { e.target.style.borderColor = 'var(--ps-accent-border)'; e.target.style.boxShadow = '0 0 0 3px var(--ps-accent-muted)'; }}
              onBlur={(e)  => { e.target.style.borderColor = 'var(--ps-panel-border)';  e.target.style.boxShadow = 'none'; }}
            />
            {errors.email && (
              <span className="text-[11px] px-1" style={{ color: 'var(--ps-regression)' }}>
                {errors.email.message}
              </span>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <div className="relative">
              <input
                {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 characters' } })}
                style={{ ...inputBase, padding: '0.625rem 2.75rem 0.625rem 0.875rem' }}
                type={showPass ? 'text' : 'password'}
                placeholder="Password"
                onFocus={(e) => { e.target.style.borderColor = 'var(--ps-accent-border)'; e.target.style.boxShadow = '0 0 0 3px var(--ps-accent-muted)'; }}
                onBlur={(e)  => { e.target.style.borderColor = 'var(--ps-panel-border)';  e.target.style.boxShadow = 'none'; }}
              />
              <button type="button" onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ps-text-muted)' }}>
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <span className="text-[11px] px-1" style={{ color: 'var(--ps-regression)' }}>
                {errors.password.message}
              </span>
            )}
          </div>

          {/* Server error */}
          {serverErr && (
            <p className="text-xs px-3 py-2 rounded-lg ps-badge-reg">{serverErr}</p>
          )}

          <button type="submit" disabled={isSubmitting}
            className="ps-btn-primary flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold mt-1 disabled:opacity-60">
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
          </button>

          <p className="text-center text-xs" style={{ color: 'var(--ps-text-muted)' }}>
            Already have an account?{' '}
            <Link to="/login" className="font-semibold" style={{ color: 'var(--ps-accent)' }}>
              Sign in
            </Link>
          </p>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: 'var(--ps-divider)' }} />
          <span className="text-xs" style={{ color: 'var(--ps-text-muted)' }}>or</span>
          <div className="flex-1 h-px" style={{ background: 'var(--ps-divider)' }} />
        </div>

        <GoogleButton onSuccess={onGoogleSuccess} onError={(msg) => setServerErr(msg)} />
      </motion.div>
    </div>
  );
}
