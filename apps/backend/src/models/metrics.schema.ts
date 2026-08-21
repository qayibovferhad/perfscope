import { Schema } from 'mongoose';

/**
 * The stored shapes of `PerformanceScores` and `CoreWebVitals`, defined once — History
 * and CompareHistory each carried their own copy and had drifted on requiredness.
 *
 * That difference is real, so it stays a parameter rather than being averaged away:
 * History stores this backend's own runs, which always carry every field — `required`
 * there turns a pipeline bug into a save error instead of a silent hole. CompareHistory's
 * sides arrive from the client (a live run, but also an uploaded or preloaded report),
 * so it stays lenient.
 */
export function makeScoresSchema(required: boolean): Schema {
  return new Schema(
    {
      performance:   { type: Number, required },
      accessibility: { type: Number, required },
      bestPractices: { type: Number, required },
      seo:           { type: Number, required },
    },
    { _id: false },
  );
}

export function makeMetricsSchema(required: boolean): Schema {
  return new Schema(
    {
      fcp: { type: Number, required },
      lcp: { type: Number, required },
      tbt: { type: Number, required },
      cls: { type: Number, required },
      si:  { type: Number, required },
      tti: { type: Number, required },
    },
    { _id: false },
  );
}
