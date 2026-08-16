import { useState } from 'react';
import { Target, Check, Pencil, X } from 'lucide-react';
import { targetProgress, readTargetValue } from '@perfscope/shared';
import type { Website } from '@/entities/website';
import type { AnalysisResult, TargetMetric } from '@perfscope/shared';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Panel, PanelHeader, PanelBody } from '@/shared/ui/panel';
import { cn } from '@/shared/lib/utils';
import { useWebsites } from '@/entities/website';
import { TARGET_FIELDS, comparatorFor, fmtTarget } from '../lib/metrics';

/**
 * What this site is aiming for, and how far off it is.
 *
 * Targets used to be editable in exactly one place — the *schedule* setup modal — so
 * setting a goal for a site meant going to configure a timetable, and the site's own page
 * could only tell you that a budget had been broken, never what the budget was.
 *
 * One number per metric does two jobs: while the page is on the wrong side of it, it is a
 * target and the advisor plans a route to it; once past, the same number is the guardrail
 * that raises an alert if the page slips back. See `packages/shared/src/lib/targets.ts`.
 */
export function TargetsPanel({ site, latest }: { site: Website; latest?: AnalysisResult | null }) {
  const { setBudgets } = useWebsites();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(() => fromSite(site));
  const [saving, setSaving] = useState(false);

  const budgets = site.budgets;
  const anySet  = TARGET_FIELDS.some(f => budgets?.[f.metric] != null);

  async function save() {
    setSaving(true);
    try {
      await setBudgets.mutateAsync({
        id: site._id,
        performance: num(draft['performance']),
        lcp:         num(draft['lcp']),
        tbt:         num(draft['tbt']),
        cls:         num(draft['cls']),
        inp:         num(draft['inp']),
        // Untouched: the alert channels belong to the schedule's setup, not to the goal.
        webhookUrl:  budgets?.webhookUrl ?? null,
        alertEmail:  budgets?.alertEmail ?? null,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel>
      <PanelHeader icon={<Target className="w-[15px] h-[15px]" />} title="Targets">
        {editing ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setDraft(fromSite(site)); setEditing(false); }}>
                <X className="w-[14px] h-[14px]" /> Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save targets'}
              </Button>
            </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => { setDraft(fromSite(site)); setEditing(true); }}>
            <Pencil className="w-[14px] h-[14px]" /> {anySet ? 'Edit' : 'Set targets'}
          </Button>
        )}
      </PanelHeader>

      <PanelBody>
        {editing ? (
          <>
            <div className="grid grid-cols-5 gap-3 max-[640px]:grid-cols-2">
              {TARGET_FIELDS.map(f => (
                <div key={f.metric}>
                  <p className="text-[11px] font-semibold text-ld-text-2 mb-1">
                    {f.label} <span className="text-ld-text-3 font-normal">{comparatorFor(f.metric)}</span>
                  </p>
                  <Input
                    value={draft[f.metric] ?? ''}
                    onChange={e => setDraft(d => ({ ...d, [f.metric]: e.target.value }))}
                    placeholder={String(f.suggested)}
                    inputMode="decimal"
                    className="h-9 text-[13px] font-mono"
                  />
                  <p className="text-[10.5px] text-ld-text-3 mt-1">{f.hint}</p>
                </div>
              ))}
            </div>
            <p className="text-[12px] text-ld-text-2 mt-4 leading-relaxed">
              Placeholders are the values Google calls good. Leave a field empty to have no
              target for it. Alert channels are set with the audit schedule.
            </p>
          </>
        ) : !anySet ? (
          <p className="text-[13px] text-ld-text-2 leading-relaxed">
            No targets yet. Set one and the advisor works out how to reach it — then keeps
            watch, so you hear about it if the page slips back below.
          </p>
        ) : (
          <ul className="space-y-[14px]">
            {TARGET_FIELDS.map(f => {
              const target = budgets?.[f.metric];
              if (target == null) return null;

              const value = latest
                ? readTargetValue(f.metric, latest.scores, latest.metrics)
                : null;
              const p = targetProgress(f.metric, value, target);

              return (
                <li key={f.metric}>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-ld-text">{f.label}</span>
                    <span className="font-mono text-[12px] text-ld-text-3">
                      {comparatorFor(f.metric)} {fmtTarget(f.metric, target)}
                    </span>

                    {p ? (
                      <span className={cn(
                        'ml-auto font-mono text-[12.5px] font-semibold',
                        p.met ? 'text-ld-accent-2' : 'text-ld-rose',
                      )}>
                        {p.met
                          ? <><Check className="inline w-[13px] h-[13px] mb-[2px]" /> {fmtTarget(f.metric, p.value)}</>
                          : `${fmtTarget(f.metric, p.value)} · ${fmtTarget(f.metric, p.gap)} to go`}
                      </span>
                    ) : (
                      <span className="ml-auto text-[12px] text-ld-text-3">
                        {f.fieldOnly ? 'field data only' : 'not measured yet'}
                      </span>
                    )}
                  </div>

                  {p && (
                    <div className="h-[5px] rounded-full bg-ld-border mt-[7px] overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-[width] duration-500',
                          p.met ? 'bg-ld-grad' : 'bg-ld-rose')}
                        style={{ width: `${Math.round(p.ratio * 100)}%` }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PanelBody>
    </Panel>
  );
}

/** Empty string for an unset target, so the input renders a placeholder rather than "null". */
function fromSite(site: Website): Record<string, string> {
  return Object.fromEntries(
    TARGET_FIELDS.map(f => [f.metric, site.budgets?.[f.metric as TargetMetric]?.toString() ?? '']),
  );
}

/** `''` and anything unparseable mean "no target", not zero. */
function num(raw: string | undefined): number | null {
  const n = Number(raw);
  return raw?.trim() && Number.isFinite(n) && n >= 0 ? n : null;
}
