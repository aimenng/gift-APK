const CLOUD_ONLY_MIGRATION_MARKER = 'gifts_cloud_only_migration_v1';
const ARCHIVE_PREFIX = 'legacy_backup_';

// Written by the local-only build that shipped before the cloud backend existed.
// Nothing reads these keys any more, but no local -> cloud upload migration was ever
// built either, so they may be the only copy of someone's memories. Archive, never delete.
const LEGACY_LOCAL_KEYS = [
  'gifts_memories',
  'gifts_events',
  'gifts_connection',
  'gifts_auth_users',
  'gifts_auth_notifications',
  'period_tracker_data',
  'pomodoro_stats',
  'pomodoro_last_date',
];

export const archiveLegacyLocalDataOnce = (): void => {
  try {
    if (localStorage.getItem(CLOUD_ONLY_MIGRATION_MARKER) === '1') return;

    for (const key of LEGACY_LOCAL_KEYS) {
      const value = localStorage.getItem(key);
      if (value === null) continue;

      try {
        localStorage.setItem(ARCHIVE_PREFIX + key, value);
        localStorage.removeItem(key);
      } catch (error) {
        // Archiving peaks at double the space because it copies before removing, and old
        // memories can hold inline base64 images. On quota failure leave the original
        // untouched — keeping stale data is recoverable, destroying it is not.
        console.error(`Failed to archive legacy key "${key}", leaving it in place:`, error);
      }
    }

    localStorage.setItem(CLOUD_ONLY_MIGRATION_MARKER, '1');
  } catch (error) {
    console.error('Failed to archive legacy local data:', error);
  }
};
