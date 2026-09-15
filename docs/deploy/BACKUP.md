# Backups

The `mongo-backup` service takes one `mongodump` a day into the `mongo-backups` volume and
keeps fourteen days. It is a `mongo:7` container because that image already carries
`mongodump`, and it reaches the database over the compose network rather than a published
port.

```
[mongo-backup] 2026-09-14T19:29:09Z wrote perfscope-20260914-192909.archive.gz (4.0K)
[mongo-backup] 2026-09-14T19:29:09Z 2 archive(s) held, 12K total
```

`BACKUP_INTERVAL_HOURS` and `BACKUP_RETENTION_DAYS` change the window. One archive per run:
`--archive --gzip` writes a single file rather than a directory of BSON, which is what makes
retention a `find -delete` and a restore one command.

**A dump is written to `.partial` and renamed only when it completes.** A backup interrupted
halfway would otherwise leave a file that looks like a backup, and the moment you find out
is the restore.

## Take one right now

Before a migration, or anything else you might want to undo:

```bash
docker compose --env-file .env.docker -f docker-compose.prod.yml \
  run --rm -e BACKUP_ONCE=1 mongo-backup
```

## Restore

```bash
# what is there
docker compose --env-file .env.docker -f docker-compose.prod.yml \
  run --rm --entrypoint sh mongo-backup -c 'ls -lt /backups'

# put one back — `--drop` replaces each collection as it restores it
docker compose --env-file .env.docker -f docker-compose.prod.yml \
  run --rm --entrypoint sh mongo-backup \
  -c 'mongorestore --uri=mongodb://mongo:27017 --archive=/backups/perfscope-20260914-192909.archive.gz --gzip --drop'
```

Indexes come back with the data — the archive carries the collection metadata, so the unique
index on `users.email` and the rest are recreated, not silently lost.

**Verified end to end on 2026-09-14**: seed a user, take a backup, `dropDatabase()`, restore,
count 1 user with the same email and both `users` indexes rebuilt.

Stopping the backend first is not required — `mongodump` is consistent per collection, and
this application writes whole documents. For a guaranteed point-in-time copy across
collections, stop the backend for the duration of the dump (seconds, at this size).

## What this is not

**These archives sit on the same host and the same disk as the data.** They protect against
a bad migration, a wrong `deleteMany`, a corrupted collection. They do not protect against
losing the machine, which is the failure people mean when they say "backup".

Getting them off the host is the operator's job and nothing here does it. The smallest
honest version is a cron on the host:

```
15 4 * * * docker run --rm -v perfscope-prod_mongo-backups:/backups -v ~/.aws:/root/.aws:ro \
             amazon/aws-cli s3 sync /backups s3://your-bucket/perfscope/
```

…with whatever storage you actually use. Until something like that runs, the answer to "do
you have backups" is "a local window, fourteen days".
