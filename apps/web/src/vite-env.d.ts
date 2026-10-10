/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** iCloud link to the shared "Invade Sync" Shortcut. */
  readonly VITE_SHORTCUT_URL?: string;
  /** '1' shows the judge demo sync button on /walk (demo day only; see docs/DEMO.md). */
  readonly VITE_DEMO_SYNC?: string;
}
