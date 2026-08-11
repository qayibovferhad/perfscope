/**
 * CrUX feature — real-user FIELD data from the Chrome UX Report, shown next to
 * Lighthouse's LAB numbers.
 *
 * Usage:
 *   const { data, isLoading } = useCruxData(url, formFactor)
 *   <CruxFieldPanel data={data} isLoading={isLoading} />
 *
 * The panel renders nothing when `data` is null (no field data, or no API key on
 * the backend), so it is safe to mount unconditionally. Pass `showEmpty` on a
 * surface that should explain the absence instead of hiding it.
 */
export { useCruxData } from './model/useCruxData';
export { CruxFieldPanel } from './ui/CruxFieldPanel';
export type { CruxFieldPanelProps } from './ui/CruxFieldPanel';
