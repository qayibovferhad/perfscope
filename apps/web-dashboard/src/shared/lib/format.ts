/**
 * Canonical display formatters. The implementation lives in @perfscope/shared so the
 * chrome extension renders values identically; this module is the dashboard's alias.
 */
export { fmtMs, fmtMsOrDash, fmtSec, fmtSec2, fmtCls, fmtBytes, fmtBytesOrDash } from '@perfscope/shared';
