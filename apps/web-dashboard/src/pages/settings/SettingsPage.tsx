import { useEffect, useState } from 'react';
import type { DigestPreference } from '@perfscope/shared';
import { useForm } from 'react-hook-form';
import { CheckCircle2, KeyRound, Loader2, Mail, ShieldCheck, User as UserIcon } from 'lucide-react';
import { Panel, PanelHeader } from '@/shared/ui/panel';
import { Page, PageHeader } from '@/shared/ui/page';
import { Toggle } from '@/shared/ui/toggle';
import { TimePicker } from '@/shared/ui/time-picker';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/shared/ui/select';
import { useAuthStore } from '@/features/auth';
import type { AuthUser } from '@/entities/user';
import { apiClient, fetchJson } from '@/shared/api/client';

interface ProfileForm  { name: string }
interface PasswordForm { currentPassword: string; newPassword: string; confirmPassword: string }

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

export function SettingsPage() {
  const { user, setAuth } = useAuthStore();

  return (
    <Page width="narrow">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your display name, sign-in password and weekly summary."
      />
      <div className="flex flex-col gap-[18px]">
        <ProfileSection user={user} setAuth={setAuth} />
        <DigestSection />
        <PasswordSection />
      </div>
    </Page>
  );
}

/* ── Weekly digest ────────────────────────────────────────────────────────── */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function DigestSection() {
  const [enabled, setEnabled] = useState(false);
  const [day,     setDay]     = useState(1);
  const [time,    setTime]    = useState('09:00');
  const [saved,   setSaved]   = useState(false);
  const [serverErr, setServerErr] = useState('');
  const [loaded,  setLoaded]  = useState(false);

  // The digest preference lives on the user document, which the auth store does not carry.
  useEffect(() => {
    fetchJson<DigestPreference>('/auth/digest')
      .then(d => {
        setEnabled(d.enabled); setDay(d.day); setTime(d.time);
      })
      .catch(() => { /* leave defaults */ })
      .finally(() => setLoaded(true));
  }, []);

  async function save(next: { enabled?: boolean; day?: number; time?: string }) {
    setServerErr('');
    setSaved(false);
    try {
      await apiClient.patch('/auth/digest', next);
      setSaved(true);
    } catch (err) {
      setServerErr(errorMessage(err, 'Could not save your digest settings'));
    }
  }

  return (
    <Panel>
      <PanelHeader icon={<Mail />} title="Weekly digest" />
      <div className="flex flex-col gap-[14px] p-[18px]">

        <div className="flex items-start justify-between gap-[16px]">
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-ld-text">Email me a weekly summary</p>
            <p className="text-[12.5px] text-ld-text-3 mt-[3px] leading-[1.5]">
              Average score movement, regressions, budget breaches and your slowest pages.
              Unlike alerts, this arrives whether or not anything went wrong.
            </p>
          </div>
          <Toggle
            enabled={enabled}
            disabled={!loaded}
            onChange={(next) => { setEnabled(next); void save({ enabled: next }); }}
          />
        </div>

        {enabled && (
          <div className="flex items-end gap-[14px] flex-wrap pt-[4px]">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-ld-text-2">Day</label>
              <Select
                value={String(day)}
                onValueChange={v => { const d = Number(v); setDay(d); void save({ day: d }); }}
              >
                <SelectTrigger className="h-9 w-[140px] text-[13px] text-ld-text bg-ld-bg-2 border-ld-border-strong rounded-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-ld-bg-2 border-ld-border">
                  {DAYS.map((label, i) => (
                    <SelectItem
                      key={label}
                      value={String(i)}
                      className="text-[13px] cursor-pointer text-ld-text focus:bg-ld-accent-soft focus:text-ld-accent"
                    >
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-ld-text-2">Time</label>
              <TimePicker value={time} onChange={(t) => { setTime(t); void save({ time: t }); }} />
            </div>
          </div>
        )}

        {serverErr && <p className="text-xs font-semibold px-3 py-2 rounded-lg text-ld-rose border border-ld-rose-line bg-ld-rose-wash">{serverErr}</p>}
        {saved && !serverErr && (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ld-accent-2">
            <CheckCircle2 className="w-4 h-4" /> Saved
          </span>
        )}
      </div>
    </Panel>
  );
}

/* ── Profile ──────────────────────────────────────────────────────────────── */

interface ProfileSectionProps {
  user:    AuthUser | null;
  setAuth: (user: AuthUser, token: string) => void;
}

function ProfileSection({ user, setAuth }: ProfileSectionProps) {
  const [saved, setSaved]         = useState(false);
  const [serverErr, setServerErr] = useState('');

  const {
    register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileForm>({ defaultValues: { name: user?.name ?? '' } });

  async function onSubmit({ name }: ProfileForm) {
    setServerErr('');
    setSaved(false);
    try {
      const res = await apiClient.patch<{ token: string; user: AuthUser }>('/auth/profile', { name });
      // The name lives in the JWT too, so swap in the re-signed token alongside the user.
      setAuth(res.data.user, res.data.token);
      reset({ name: res.data.user.name }); // clears isDirty so the Save button settles
      setSaved(true);
    } catch (err) {
      setServerErr(errorMessage(err, 'Could not update your profile'));
    }
  }

  return (
    <Panel>
      <PanelHeader icon={<UserIcon />} title="Profile" />
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[14px] p-[18px]">

        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-semibold text-ld-text-2">Display name</label>
          <Input
            {...register('name', {
              required:  'Display name is required',
              maxLength: { value: 60, message: 'Max 60 characters' },
            })}
            placeholder="Your name"
            icon={<UserIcon />}
            error={!!errors.name}
          />
          {errors.name && (
            <span className="text-[11px] px-1 text-ld-rose">{errors.name.message}</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-semibold text-ld-text-2">Email</label>
          <Input value={user?.email ?? ''} icon={<Mail />} disabled readOnly />
          <span className="text-[11px] px-1 text-ld-text-3">
            Your email is tied to your account and cannot be changed here.
          </span>
        </div>

        {serverErr && (
          <p className="text-xs font-semibold px-3 py-2 rounded-lg text-ld-rose border border-ld-rose-line bg-ld-rose-wash">{serverErr}</p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" size="md" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? <Loader2 className="animate-spin" /> : 'Save changes'}
          </Button>
          {saved && !isDirty && (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ld-accent-2">
              <CheckCircle2 className="w-4 h-4" />
              Saved
            </span>
          )}
        </div>
      </form>
    </Panel>
  );
}

/* ── Password ─────────────────────────────────────────────────────────────── */

function PasswordSection() {
  const [saved, setSaved]         = useState(false);
  const [serverErr, setServerErr] = useState('');

  const {
    register, handleSubmit, reset, watch, formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const newPassword = watch('newPassword');

  async function onSubmit({ currentPassword, newPassword: next }: PasswordForm) {
    setServerErr('');
    setSaved(false);
    try {
      await apiClient.patch('/auth/password', { currentPassword, newPassword: next });
      reset();
      setSaved(true);
    } catch (err) {
      setServerErr(errorMessage(err, 'Could not change your password'));
    }
  }

  return (
    <Panel>
      <PanelHeader icon={<ShieldCheck />} title="Password" />
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[14px] p-[18px]">

        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-semibold text-ld-text-2">Current password</label>
          <Input
            {...register('currentPassword')}
            type="password"
            placeholder="Current password"
            icon={<KeyRound />}
            autoComplete="current-password"
          />
          <span className="text-[11px] px-1 text-ld-text-3">
            Leave empty if you signed up with Google and have not set a password yet.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-semibold text-ld-text-2">New password</label>
          <Input
            {...register('newPassword', {
              required:  'New password is required',
              minLength: { value: 6, message: 'Min 6 characters' },
            })}
            type="password"
            placeholder="New password"
            icon={<KeyRound />}
            error={!!errors.newPassword}
            autoComplete="new-password"
          />
          {errors.newPassword && (
            <span className="text-[11px] px-1 text-ld-rose">{errors.newPassword.message}</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-semibold text-ld-text-2">Confirm new password</label>
          <Input
            {...register('confirmPassword', {
              required: 'Please repeat the new password',
              validate: (v) => v === newPassword || 'Passwords do not match',
            })}
            type="password"
            placeholder="Repeat new password"
            icon={<KeyRound />}
            error={!!errors.confirmPassword}
            autoComplete="new-password"
          />
          {errors.confirmPassword && (
            <span className="text-[11px] px-1 text-ld-rose">{errors.confirmPassword.message}</span>
          )}
        </div>

        {serverErr && (
          <p className="text-xs font-semibold px-3 py-2 rounded-lg text-ld-rose border border-ld-rose-line bg-ld-rose-wash">{serverErr}</p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" size="md" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" /> : 'Change password'}
          </Button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ld-accent-2">
              <CheckCircle2 className="w-4 h-4" />
              Password updated
            </span>
          )}
        </div>
      </form>
    </Panel>
  );
}
