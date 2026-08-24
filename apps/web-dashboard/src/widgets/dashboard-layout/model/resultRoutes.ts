/**
 * The routes that already show an audit result.
 *
 * A finished run is announced two ways — a toast where the reader was looking, and a card
 * in the sidebar to come back to. Neither is worth anything on the pages that *are* the
 * result: the analyzer draws the scores as they arrive, and the compare page is two of
 * them side by side. Announcing something already on screen is how people learn to ignore
 * announcements, and a card saying "open the report" while the report is open points at
 * the page it is drawn on.
 *
 * One list, read by the toast (which decides whether to fire) and by the sidebar (which
 * decides whether to draw the card), so the two cannot disagree about where the reader is.
 */
const RESULT_ROUTES = ['/app', '/compare'];

export const isResultRoute = (pathname: string): boolean => RESULT_ROUTES.includes(pathname);
