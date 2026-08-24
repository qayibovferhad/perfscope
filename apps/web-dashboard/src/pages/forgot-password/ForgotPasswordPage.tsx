import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { apiClient } from '@/shared/api/client';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { AuthCard } from '@/shared/ui/auth-card';

interface FormValues { email: string }

/**
 * "I forgot my password."
 *
 * The screen says the same thing whatever the answer was — sent, or no such account. That
 * is not vagueness for its own sake: this is the one form anyone on the internet can post
 * any address to, and a page that distinguishes the two outcomes is a way to find out who
 * has an account here. The server is built the same way; see passwordReset.service.
 */
export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [serverErr, setServerErr] = useState('');
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<FormValues>();

  async function onSubmit({ email }: FormValues) {
    setServerErr('');
    try {
      await apiClient.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setServerErr(msg ?? 'Could not send the reset email. Try again in a moment.');
    }
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle={sent ? 'Check your inbox' : 'We will email you a link to set a new one'}
    >
      {sent ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
          <p className="text-[13px] leading-relaxed text-ps-muted">
            If <span className="font-semibold text-ps-heading">{getValues('email')}</span> has an
            account, a reset link is on its way. It works once and expires in an hour.
          </p>
          <p className="text-[12px] leading-relaxed text-ps-muted">
            Nothing arrived? Check spam, then try again — the newest link is the only one that works.
          </p>
          <Link to="/login" className="text-center text-xs font-semibold text-ps-accent">
            Back to sign in
          </Link>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
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
              autoFocus
            />
            {errors.email && (
              <span className="text-[11px] px-1 text-ps-regression">{errors.email.message}</span>
            )}
          </div>

          {serverErr && <p className="text-xs px-3 py-2 rounded-lg ps-badge-reg">{serverErr}</p>}

          <Button type="submit" disabled={isSubmitting} className="w-full mt-1">
            {isSubmitting ? <Loader2 className="animate-spin" /> : 'Send reset link'}
          </Button>

          <Link to="/login" className="flex items-center justify-center gap-1.5 text-xs text-ps-muted hover:text-ps-heading transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
          </Link>
        </form>
      )}
    </AuthCard>
  );
}
