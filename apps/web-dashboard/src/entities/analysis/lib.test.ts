import { describe, it, expect } from 'vitest';
import { scoreBand, vitalBand, scoreColor, deltaOf, matchesAuditQuery, groupAudits, parseAuditDescription, SCORE_GOOD, SCORE_WARN, SCORE_BAD } from './lib';

describe('scoreBand', () => {
  it('maps ScoreRating to the compact display band', () => {
    expect(scoreBand(95)).toBe('good');
    expect(scoreBand(70)).toBe('warn');
    expect(scoreBand(20)).toBe('poor');
  });
});

describe('vitalBand', () => {
  it('shares thresholds with @perfscope/shared', () => {
    expect(vitalBand('cls', 0.05)).toBe('good');
    expect(vitalBand('cls', 0.2)).toBe('warn');
    expect(vitalBand('tbt', 700)).toBe('poor');
  });
});

describe('scoreColor', () => {
  it('derives from the same bands', () => {
    expect(scoreColor(95)).toBe(SCORE_GOOD);
    expect(scoreColor(60)).toBe(SCORE_WARN);
    expect(scoreColor(10)).toBe(SCORE_BAD);
  });
});

describe('deltaOf', () => {
  it('returns null without a baseline', () => {
    expect(deltaOf('score', 80, undefined)).toBeNull();
    expect(deltaOf('score', 80, null)).toBeNull();
  });

  it('reads a higher score as better and a lower one as worse', () => {
    expect(deltaOf('score', 84, 70)).toEqual({ diff: 14, direction: 'better', meaningful: true });
    expect(deltaOf('score', 56, 70)).toEqual({ diff: -14, direction: 'worse', meaningful: true });
  });

  it('keeps a score move inside SCORE_NOISE_POINTS unmeaningful', () => {
    // 8 points is under the 10-point floor scoreVerdict uses — shown, but muted.
    expect(deltaOf('score', 78, 70)).toEqual({ diff: 8, direction: 'better', meaningful: false });
  });

  it('reads a lower vital as better', () => {
    const d = deltaOf('lcp', 1800, 2600);
    expect(d).toEqual({ diff: -800, direction: 'better', meaningful: true });
  });

  it('requires both the absolute floor and the percentage for a vital', () => {
    // 60ms on 2500ms: clears METRIC_NOISE.lcp (100) neither way — and 2.4% is under 15%.
    expect(deltaOf('lcp', 2560, 2500)?.meaningful).toBe(false);
    // 40ms on 100ms is 40%, but under the 100ms absolute floor for LCP.
    expect(deltaOf('lcp', 140, 100)?.meaningful).toBe(false);
    // 500ms on 2500ms clears both.
    expect(deltaOf('lcp', 3000, 2500)?.meaningful).toBe(true);
  });

  it('judges fcp/si/tti on percentage alone — they have no absolute floor', () => {
    expect(deltaOf('si', 140, 100)?.meaningful).toBe(true);
    expect(deltaOf('si', 105, 100)?.meaningful).toBe(false);
  });

  it('reports an unchanged value as same', () => {
    expect(deltaOf('cls', 0.1, 0.1)).toEqual({ diff: 0, direction: 'same', meaningful: false });
  });
});

describe('matchesAuditQuery', () => {
  const base = {
    id: 'color-contrast',
    title: 'Background and foreground colors do not have a sufficient contrast ratio',
    description: 'Low-contrast text is difficult or impossible for many users to read.',
    score: 0,
    displayValue: undefined,
    impact: 'critical' as const,
  };

  it('matches everything on an empty or whitespace query', () => {
    expect(matchesAuditQuery(base, '')).toBe(true);
    expect(matchesAuditQuery(base, '   ')).toBe(true);
  });

  it('matches the title and the description, case-insensitively', () => {
    expect(matchesAuditQuery(base, 'CONTRAST')).toBe(true);
    expect(matchesAuditQuery(base, 'low-contrast text')).toBe(true);
    expect(matchesAuditQuery(base, 'lighthouse')).toBe(false);
  });

  it('searches the evidence, which is the half a reviewer knows by name', () => {
    const withDetails = {
      ...base,
      details: [
        { selector: 'a.AnchorInlineLink-sc-1mrbsw3-0', snippet: '<a class="AnchorInlineLink">Read more</a>' },
        { url: 'https://cdn.example.com/assets/hero-large.jpg', value: '312KB wasted' },
      ],
    };
    expect(matchesAuditQuery(withDetails, 'AnchorInlineLink')).toBe(true);
    expect(matchesAuditQuery(withDetails, 'hero-large.jpg')).toBe(true);
    expect(matchesAuditQuery(withDetails, '312KB')).toBe(true);
    expect(matchesAuditQuery(withDetails, 'read more')).toBe(true);
    expect(matchesAuditQuery(withDetails, 'nothing-here')).toBe(false);
  });

  it('matches the Lighthouse group name', () => {
    expect(matchesAuditQuery({ ...base, group: 'Contrast' }, 'contrast')).toBe(true);
    expect(matchesAuditQuery({ ...base, group: 'Names and labels' }, 'labels')).toBe(true);
  });

  it('does not throw on an audit with no details', () => {
    // 'x' would have matched "text" in the description — the point here is the empty array.
    expect(matchesAuditQuery({ ...base, details: [] }, 'zzz-no-such-thing')).toBe(false);
  });
});

describe('groupAudits', () => {
  const a = (id: string, group?: string) => ({
    id, title: id, description: '', score: 0, displayValue: undefined,
    impact: 'high' as const, ...(group ? { group } : {}),
  });

  it('keeps the input order, so the group holding the worst finding leads', () => {
    const out = groupAudits([a('one', 'Contrast'), a('two', 'Names and labels'), a('three', 'Contrast')]);
    expect(out.map(g => g.group)).toEqual(['Contrast', 'Names and labels']);
    expect(out[0].items.map(i => i.id)).toEqual(['one', 'three']);
  });

  it('collects audits with no group under "Other"', () => {
    const out = groupAudits([a('one'), a('two', 'Contrast')]);
    expect(out.map(g => g.group)).toEqual(['Other', 'Contrast']);
  });

  it('returns one entry when everything shares a group — the caller decides if that is worth a header', () => {
    expect(groupAudits([a('one', 'Contrast'), a('two', 'Contrast')])).toHaveLength(1);
  });

  it('is empty for an empty list', () => {
    expect(groupAudits([])).toEqual([]);
  });
});

describe('parseAuditDescription', () => {
  it('splits Lighthouse\'s trailing "learn more" link out of the prose', () => {
    const parts = parseAuditDescription(
      'Low-contrast text is hard to read. [Learn how to provide sufficient color contrast](https://dequeuniversity.com/rules/axe/4.10/color-contrast).',
    );
    expect(parts).toEqual([
      { text: 'Low-contrast text is hard to read. ' },
      { text: 'Learn how to provide sufficient color contrast', href: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast' },
      { text: '.' },
    ]);
  });

  it('returns one plain part when there is no link', () => {
    expect(parseAuditDescription('Just a sentence.')).toEqual([{ text: 'Just a sentence.' }]);
  });

  it('handles several links', () => {
    const parts = parseAuditDescription('See [one](https://a.example) and [two](https://b.example).');
    expect(parts.filter(p => p.href).map(p => p.href)).toEqual(['https://a.example', 'https://b.example']);
  });

  it('leaves a non-http target as prose rather than linking it', () => {
    const parts = parseAuditDescription('Try [this](javascript:alert(1)) instead.');
    expect(parts.every(p => !p.href)).toBe(true);
  });

  it('is empty-safe', () => {
    expect(parseAuditDescription('')).toEqual([]);
  });
});
