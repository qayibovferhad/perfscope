import type { Deploy } from '../types/deploy.js';

/**
 * What a deploy marker is called on a chart.
 *
 * A chart has room for about a dozen characters before markers start colliding, and a
 * commit sha is forty. Whatever the pipeline chose to call the release wins; a sha is cut
 * to the seven characters people actually quote; and a deploy that carried neither is
 * still worth drawing, so it falls back to its date rather than an empty label.
 */
export function deployLabel(deploy: Pick<Deploy, 'label' | 'ref' | 'at'>): string {
  if (deploy.label?.trim()) return deploy.label.trim();
  const ref = deploy.ref?.trim();
  // Only a long, hex-looking ref is a sha worth truncating: "v2.4.0" and "build-812" are
  // already names, and cutting them mid-word makes two releases look like one.
  if (ref) return /^[0-9a-f]{12,}$/i.test(ref) ? ref.slice(0, 7) : ref;
  return new Date(deploy.at).toLocaleDateString();
}
