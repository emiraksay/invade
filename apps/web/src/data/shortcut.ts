/** Name of the shared iOS Shortcut; must match exactly what players install (docs/SHORTCUT.md). */
export const SYNC_SHORTCUT_NAME = 'Invade Sync';

/** Runs the Shortcut from the web app (iOS asks once for permission). */
export const SYNC_SHORTCUT_URL = `shortcuts://run-shortcut?name=${encodeURIComponent(SYNC_SHORTCUT_NAME)}`;
