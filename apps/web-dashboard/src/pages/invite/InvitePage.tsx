import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Users } from 'lucide-react';
import { AuthCard } from '@/shared/ui/auth-card';
import { Button } from '@/shared/ui/button';
import { StatePanel } from '@/shared/ui/state-panel';
import { useAuthStore } from '@/features/auth';
import { useEnterTeam, useAcceptInvite, useInvitePreview } from '@/features/teams';

/**
 * The page an invitation link opens.
 *
 * Public on purpose: the person following the link may not have an account yet, and being
 * bounced to a login screen with no idea what they were invited to is how an invitation
 * gets ignored. The preview names the team and the role first, then asks for a sign-in —
 * carrying this address in `?redirect` so they land back here, one click from joining.
 *
 * An invalid link says only that it is invalid. It never names the team it belonged to: a
 * spent or guessed token should not tell a stranger that an organisation exists.
 */
export function InvitePage() {
  const { token = '' } = useParams();
  const user      = useAuthStore(s => s.user);
  const navigate  = useNavigate();
  const enterTeam = useEnterTeam();
  const accept    = useAcceptInvite();
  const { data: preview, isPending } = useInvitePreview(token);

  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (joined) navigate('/dashboard', { replace: true });
  }, [joined, navigate]);

  async function join() {
    const team = await accept.mutateAsync(token);
    // Straight into the team they just joined — landing on your own empty account after
    // accepting an invitation reads as the invitation having failed.
    enterTeam({ id: team.id, name: team.name, role: team.role, members: team.members, ownerName: team.ownerName });
    setJoined(true);
  }

  if (isPending) {
    return (
      <AuthCard title="Invitation" subtitle="Checking this link…">
        <div className="grid place-items-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-ld-text-3" />
        </div>
      </AuthCard>
    );
  }

  if (!preview?.valid) {
    return (
      <AuthCard title="Invitation" subtitle="">
        <StatePanel
          variant="error"
          title="This link is no longer valid"
          description="Invitations work once and expire after seven days. Ask whoever sent it for a new one."
        />
        <Link to="/" className="block mt-4 text-center text-[12.5px] text-ld-accent hover:underline">
          Back to PerfScope
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={`Join ${preview.team}`}
      subtitle={`${preview.invitedBy || 'Someone'} invited you as a ${preview.role}.`}
    >
      <p className="text-[12.5px] text-ld-text-2">
        {preview.role === 'viewer'
          ? "You will be able to read this team's sites, audits and reports."
          : "You will be able to run audits and edit this team's sites, flows and budgets."}
      </p>

      {user ? (
        <Button className="w-full mt-4" onClick={join} disabled={accept.isPending}>
          {accept.isPending ? <Loader2 className="animate-spin" /> : <Users className="w-4 h-4" />}
          Join {preview.team}
        </Button>
      ) : (
        <div className="flex flex-col gap-2 mt-4">
          <Button asChild className="w-full">
            <Link to={`/login?redirect=/invite/${token}`}>Sign in to join</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to={`/register?redirect=/invite/${token}`}>Create an account</Link>
          </Button>
        </div>
      )}
    </AuthCard>
  );
}
