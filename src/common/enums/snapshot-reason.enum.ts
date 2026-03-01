/**
 * Reasons for creating permission snapshots
 */
export enum SnapshotReason {
  PERMISSION_GRANT = 'PERMISSION_GRANT',
  PERMISSION_REVOKE = 'PERMISSION_REVOKE',
  HIERARCHY_CHANGE = 'HIERARCHY_CHANGE',
  INITIAL_SETUP = 'INITIAL_SETUP',
}
