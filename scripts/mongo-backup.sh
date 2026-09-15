#!/bin/sh
# A dump of the PerfScope database, on a loop, with retention.
#
# Runs inside a `mongo:7` container (which already has mongodump) as the `mongo-backup`
# service, so it needs no tooling on the host and reaches the database over the compose
# network rather than a published port.
#
# One archive per run — `--archive --gzip` writes a single file rather than a directory of
# BSON, which is what makes retention a `find -delete` and a restore one command. Weekly
# copies are NOT kept separately: this is a daily window, and anything longer belongs
# off-host, which this script deliberately does not pretend to do (see BACKUP.md).
set -eu

MONGODB_URI="${MONGODB_URI:-mongodb://mongo:27017/perfscope}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_INTERVAL_HOURS="${BACKUP_INTERVAL_HOURS:-24}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
# Unset for the loop the container runs; set to 1 to take one dump and exit, which is what
# a person does before a risky migration.
BACKUP_ONCE="${BACKUP_ONCE:-}"

log() { echo "[mongo-backup] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }

take_backup() {
  mkdir -p "$BACKUP_DIR"
  archive="$BACKUP_DIR/perfscope-$(date -u +%Y%m%d-%H%M%S).archive.gz"

  # To a temporary name first: a dump interrupted halfway would otherwise leave a file that
  # looks like a backup, and the time you find out is the restore.
  if mongodump --uri="$MONGODB_URI" --archive="$archive.partial" --gzip --quiet; then
    mv "$archive.partial" "$archive"
    log "wrote $(basename "$archive") ($(du -h "$archive" | cut -f1))"
  else
    rm -f "$archive.partial"
    log "FAILED — dump did not complete; keeping previous archives"
    return 1
  fi

  deleted=$(find "$BACKUP_DIR" -name 'perfscope-*.archive.gz' -mtime "+$BACKUP_RETENTION_DAYS" -print -delete | wc -l)
  [ "$deleted" -gt 0 ] && log "pruned $deleted archive(s) older than ${BACKUP_RETENTION_DAYS}d"

  log "$(find "$BACKUP_DIR" -name 'perfscope-*.archive.gz' | wc -l) archive(s) held, $(du -sh "$BACKUP_DIR" | cut -f1) total"
  return 0
}

if [ -n "$BACKUP_ONCE" ]; then
  take_backup
  exit $?
fi

log "starting — every ${BACKUP_INTERVAL_HOURS}h, keeping ${BACKUP_RETENTION_DAYS}d, into $BACKUP_DIR"
while true; do
  # A failed dump must not stop the loop: the next one may well succeed, and a backup
  # service that exits quietly is worse than no backup service, because the compose ps
  # still says "Exited (1)" three weeks later.
  take_backup || log "continuing after a failed run"
  sleep "$((BACKUP_INTERVAL_HOURS * 3600))"
done
