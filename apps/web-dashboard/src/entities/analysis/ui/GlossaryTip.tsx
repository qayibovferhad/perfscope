import { InfoTip } from '@/shared/ui/info-tip';
import {
  GLOSSARY, thresholdLine, CATEGORY_BAND_LINE, isVitalKey, type GlossaryKey,
} from '../glossary';

/**
 * The (i) beside a metric or category label.
 *
 * One component so the wording, the threshold line and the layout of an explanation
 * exist in exactly one place — every surface that shows a metric gets the same answer.
 */
export function GlossaryTip({ term }: { term: GlossaryKey }) {
  const entry = GLOSSARY[term];

  return (
    <InfoTip
      label={`About ${entry.title}`}
      content={
        <span className="block">
          <b className="block text-[12px] font-semibold text-ld-text">{entry.title}</b>
          <span className="block mt-[5px]">{entry.measures}</span>
          <span className="block mt-[5px] text-ld-text-3">{entry.matters}</span>
          <span className="block mt-[8px] pt-[7px] border-t border-ld-border font-mono text-[10.5px] text-ld-text-3 tabular-nums">
            {isVitalKey(term) ? thresholdLine(term) : CATEGORY_BAND_LINE}
          </span>
        </span>
      }
    />
  );
}
