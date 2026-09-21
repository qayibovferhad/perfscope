import type { OverviewTotals } from '@perfscope/shared';
import { scoreBand } from '@/entities/analysis';
import { InstrumentBand, Readout } from '@/shared/ui/instrument';

/**
 * The account's headline reading, and the three counts that qualify it.
 *
 * This was four identical stat cards — the same box, the same tile, the same type size,
 * four across — which made the average score of every site the reader owns look exactly
 * as important as how many audits happened to land in the window. It is not: it is the
 * number the page exists to report, and the other three are its context.
 *
 * `avgScore` and `needsAttention` still come from the same backend helper the websites
 * summary uses, so the two screens cannot disagree about what a site scores.
 */
export function TotalsStrip({ totals, days, label }: {
  totals: OverviewTotals;
  days: number;
  /** How the window is named on this page — passed in rather than derived, because a range
   *  picked as two dates has no "N days" name worth showing beside a count. */
  label?: string;
}) {
  const windowLabel = label ?? `${days} days`;
  const measured = totals.audited > 0;

  return (
    <InstrumentBand
      className="mb-[26px]"
      reading={{
        value: measured ? totals.avgScore : null,
        tone: measured ? scoreBand(totals.avgScore) : 'neutral',
        label: 'Avg score',
        caption: measured
          ? `across ${totals.audited} audited ${totals.audited === 1 ? 'site' : 'sites'}`
          : 'nothing audited yet',
        ariaLabel: measured
          ? `Average score ${totals.avgScore} out of 100`
          : 'No site audited yet',
      }}
    >
      <Readout label="Sites tracked" value={totals.sites} tone="accent" tint />
      <Readout
        // Named after the window on screen — "Audits this week" beside a 90-day range is
        // a label that quietly contradicts the control the reader just used.
        label="Audits"
        value={totals.auditsInWindow}
        sub={windowLabel}
        // Teal, not emerald: it is a different subject from the sites beside it, and three
        // readings in one colour is the flatness this band was meant to fix.
        tone="teal"
        tint
      />
      <Readout
        label="Below 50"
        value={totals.needsAttention}
        // Only tinted when there is something to be alarmed about: a rose field over a
        // zero is an alarm that cries every morning.
        tone={totals.needsAttention > 0 ? 'poor' : 'neutral'}
        tint={totals.needsAttention > 0}
        sub={totals.sites ? `of ${totals.sites} tracked` : undefined}
        // A share of the account, not a bare count: two failing sites out of three is a
        // different morning from two out of forty.
        fill={totals.sites ? totals.needsAttention / totals.sites : 0}
      />
    </InstrumentBand>
  );
}
