/**
 * Ranking a command against what has been typed.
 *
 * Subsequence matching, not substring: people type the initials of what they want
 * ("nw" for New Audit, "ash" for Audit schedule) far more often than a contiguous
 * fragment, and a substring filter answers those with nothing at all.
 *
 * The score exists so that the obvious answer is first, which is the whole point of
 * typing two letters and hitting Enter. A prefix beats a word start beats a scattered
 * match, and a shorter label wins ties — "History" should outrank "Compare history"
 * for "hist".
 */
export interface Match {
  score: number;
  /** Indices of the matched characters, for highlighting. */
  hits:  number[];
}

export function match(text: string, query: string): Match | null {
  if (!query) return { score: 0, hits: [] };

  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();

  if (haystack.startsWith(needle)) {
    return { score: 1000 - text.length, hits: [...needle].map((_, i) => i) };
  }

  const hits: number[] = [];
  let at = 0;
  let score = 0;

  for (const ch of needle) {
    const found = haystack.indexOf(ch, at);
    if (found === -1) return null;
    // A character starting a word is what someone typing initials means; one landing
    // mid-word is a coincidence that happens to spell the query.
    const startsWord = found === 0 || /[\s/\-_.]/.test(haystack[found - 1] ?? '');
    score += startsWord ? 12 : 2;
    // Consecutive characters are a fragment of the real word, not a scatter.
    if (found === at && hits.length) score += 6;
    hits.push(found);
    at = found + 1;
  }

  return { score: score - text.length * 0.1, hits };
}
