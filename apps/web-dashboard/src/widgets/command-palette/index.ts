/**
 * The ⌘K palette: every site, page and action reachable by typing its name.
 *
 * Mounted by the app layer rather than the shell, because a widget may not import
 * another widget and the palette belongs to the whole authenticated area, not to the
 * sidebar that happens to advertise it.
 */
export { CommandPalette } from './ui/CommandPalette';
