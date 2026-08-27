import { useEffect, useState } from 'react';
import type { AuthResponse, DigestPreference } from '@perfscope/shared';
import { useForm } from 'react-hook-form';
import { KeyRound, Loader2, LogOut, Mail, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useSaveState } from './ui/useSaveState';
import { SaveError, SavedChip } from './ui/saveState';
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
import { Field } from '@/shared/ui/field';

interface ProfileForm  { name: string }
interface PasswordForm { currentPassword: string; newPassword: string; confirmPassword: string }

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
        <SessionsSection />
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
  const [loaded,  setLoaded]  = useState(false);
  const { saved, error, run } = useSaveState('Could not save your digest settings');

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
    await run(async () => { await apiClient.patch('/auth/digest', next); });
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
            label="Email me a weekly summary"
            enabled={enabled}
            disabled={!loaded}
            onChange={(next) => { setEnabled(next); void save({ enabled: next }); }}
          />
        </div>

        {enabled && (
          <div className="flex items-end gap-[14px] flex-wrap pt-[4px]">
            <Field label="Day">
              {(id) => (
              <Select
                value={String(day)}
                onValueChange={v => { const d = Number(v); setDay(d); void save({ day: d }); }}
              >
                <SelectTrigger id={id} className="h-9 w-[140px] text-[13px] text-ld-text bg-ld-bg-2 border-ld-border-strong rounded-[10px]">
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
              )}
            </Field>

            {/* The time picker is two selects of its own, so the label names the pair
                rather than pointing at one half of it. */}
            <div className="flex flex-col gap-1.5" role="group" aria-label="Time">
              <span className="text-[12.5px] font-semibold text-ld-text-2">Time</span>
              <TimePicker value={time} onChange={(t) => { setTime(t); void save({ time: t }); }} />
            </div>
          </div>
        )}

        {error && <SaveError>{error}</SaveError>}
        {saved && !error && <SavedChip />}
      </div>
    </Panel>
  );
}

/* ── Profile ──────────────────────────────────────────────────────────────── */

interface ProfileSectionProps {
  user:    AuthUser | null;
  setAuth: (user: AuthUser, token: string, refreshToken?: string | null) => void;
}

function ProfileSection({ user, setAuth }: ProfileSectionProps) {
  const { saved, error, run } = useSaveState('Could not update your profile');

  const {
    register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileForm>({ defaultValues: { name: user?.name ?? '' } });

  async function onSubmit({ name }: ProfileForm) {
    await run(async () => {
      const res = await apiClient.patch<AuthResponse>('/auth/profile', { name });
      // The name lives in the JWT too, so swap in the re-signed token alongside the user —
      // and the refresh token with it, because renaming mints a whole new session.
      setAuth(res.data.user, res.data.token, res.data.refreshToken);
      reset({ name: res.data.user.name }); // clears isDirty so the Save button settles
    });
  }

  return (
    <Panel>
      <PanelHeader icon={<UserIcon />} title="Profile" />
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[14px] p-[18px]">

        <Field label="Display name" error={errors.name?.message}>
          {(id) => (
            <Input
              id={id}
              {...register('name', {
                required:  'Display name is required',
                maxLength: { value: 60, message: 'Max 60 characters' },
              })}
              placeholder="Your name"
              icon={<UserIcon />}
              error={!!errors.name}
            />
          )}
        </Field>

        <Field label="Email" hint="Your email is tied to your account and cannot be changed here.">
          {/* The field Lighthouse flagged: disabled and read-only, with no placeholder to
              fall back on, so it had no accessible name at all. */}
          {(id) => <Input id={id} value={user?.email ?? ''} icon={<Mail />} disabled readOnly />}
        </Field>

        {error && <SaveError>{error}</SaveError>}

        <div className="flex items-center gap-3">
          <Button type="submit" size="md" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? <Loader2 className="animate-spin" /> : 'Save changes'}
          </Button>
          {saved && !isDirty && <SavedChip />}
        </div>
      </form>
    </Panel>
  );
}

/* ── Password ─────────────────────────────────────────────────────────────── */

function PasswordSection() {
  const { saved, error, run } = useSaveState('Could not change your password');
  const [endedSessions, setEndedSessions] = useState(0);

  const {
    register, handleSubmit, reset, watch, formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  // Same as the reset-password form: `watch` is un-memoizable by design.
  // eslint-disable-next-line react-hooks/incompatible-library
  const newPassword = watch('newPassword');

  async function onSubmit({ currentPassword, newPassword: next }: PasswordForm) {
    await run(async () => {
      // Sending our own refresh token is what keeps *this* tab signed in: the server ends
      // every other session on a password change, which is the point of changing one.
      const refreshToken = useAuthStore.getState().refreshToken;
      const res = await apiClient.patch<{ ended: number }>('/auth/password', {
        currentPassword, newPassword: next, refreshToken,
      });
      setEndedSessions(res.data?.ended ?? 0);
      reset();
    });
  }

  return (
    <Panel>
      <PanelHeader icon={<ShieldCheck />} title="Password" />
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[14px] p-[18px]">

        <Field
          label="Current password"
          hint="Leave empty if you signed up with Google and have not set a password yet."
        >
          {(id) => (
            <Input
              id={id}
              {...register('currentPassword')}
              type="password"
              placeholder="Current password"
              icon={<KeyRound />}
              autoComplete="current-password"
            />
          )}
        </Field>

        <Field label="New password" error={errors.newPassword?.message}>
          {(id) => (
            <Input
              id={id}
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
          )}
        </Field>

        <Field label="Confirm new password" error={errors.confirmPassword?.message}>
          {(id) => (
            <Input
              id={id}
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
          )}
        </Field>

        {error && <SaveError>{error}</SaveError>}

        <div className="flex items-center gap-3">
          <Button type="submit" size="md" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" /> : 'Change password'}
          </Button>
          {saved && <SavedChip label="Password updated" />}
        </div>
        {saved && endedSessions > 0 && (
          <span className="text-[11.5px] text-ld-text-3">
            {endedSessions === 1
              ? 'One other signed-in device was signed out.'
              : `${endedSessions} other signed-in devices were signed out.`}
          </span>
        )}
      </form>
    </Panel>
  );
}

/* ── Sessions ─────────────────────────────────────────────────────────────── */

/**
 * The lost-laptop button.
 *
 * A signed-in device holds a refresh token that is good for a month, and until this existed
 * there was no way to take one back: clearing localStorage on the machine in front of you
 * says nothing about the one you left on a train. This ends every session except this tab's.
 *
 * It reports the number rather than saying "done", because "no other devices were signed in"
 * and "four were" are different pieces of news and only one of them means anything.
 */
function SessionsSection() {
  const { saved, error, run } = useSaveState('Could not sign out your other devices');
  const [ended, setEnded] = useState<number | null>(null);

  async function signOutOthers() {
    await run(async () => {
      const refreshToken = useAuthStore.getState().refreshToken;
      const res = await apiClient.post<{ ended: number }>('/auth/logout-all', { refreshToken });
      setEnded(res.data?.ended ?? 0);
    });
  }

  return (
    <Panel>
      <PanelHeader icon={<LogOut />} title="Signed-in devices" />
      <div className="flex flex-col gap-[14px] p-[18px]">
        <p className="text-[12.5px] leading-relaxed text-ld-text-2">
          Signing in on a browser, the CLI or the extension creates a session that stays valid
          for 30&nbsp;days. Ending them all leaves only this tab signed in — do it if a device
          was lost, or if you shared a machine.
        </p>

        {error && <SaveError>{error}</SaveError>}

        <div className="flex items-center gap-3">
          <Button type="button" variant="destructive-soft" size="md" onClick={signOutOthers}>
            Sign out other devices
          </Button>
          {saved && ended !== null && (
            <span className="text-[11.5px] text-ld-text-3">
              {ended === 0 ? 'No other devices were signed in.'
                : ended === 1 ? 'One device was signed out.'
                : `${ended} devices were signed out.`}
            </span>
          )}
        </div>
      </div>
    </Panel>
  );
}
