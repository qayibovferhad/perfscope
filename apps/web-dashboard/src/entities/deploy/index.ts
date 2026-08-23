/**
 * Deploys: the releases marked on a site's charts.
 *
 * An entity rather than a feature because two different features consume it — history
 * draws the markers inside its own card, and anything else that plots a site over time
 * will want the same rows. A feature cannot import another feature, and duplicating the
 * fetch is how the two would drift apart.
 */
export { useDeploys } from './model/useDeploys';
export { MarkDeployButton } from './ui/MarkDeployButton';
