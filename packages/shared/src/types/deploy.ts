/**
 * A deployment, recorded so a chart can say *why* a line moved.
 *
 * A performance chart shows that something changed on the eleventh; it cannot show that
 * the eleventh is when the image loader was swapped. Without that, reading a regression
 * means going to the git log with a date in hand and guessing. Marking releases on the
 * chart turns "something got worse" into "this got worse after that", which is the whole
 * question anyone has when they open the page.
 */
export interface Deploy {
  _id:       string
  websiteId: string
  /** When it went out. Supplied by the caller — CI records a deploy after the fact. */
  at:        string
  /** Commit sha, tag, build number — whatever the pipeline knows itself by. */
  ref?:      string
  /** Human label: "v2.4.0", "hotfix: cart". Falls back to a short `ref` on the chart. */
  label?:    string
  /** Where to read about it — a commit, a PR, a pipeline run. */
  url?:      string
  createdAt: string
}

/** What a caller may send. Everything but the site is optional: a bare "we deployed" is
 *  still worth more on a chart than nothing. */
export interface DeployInput {
  at?:    string
  ref?:   string
  label?: string
  url?:   string
}
