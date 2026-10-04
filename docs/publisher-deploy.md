# Publisher container preparation (W3-CLOUDRUN)

This package prepares an image and an offline dry run. **Cloud Run deployment
is withheld.** No cloud commands are executed by the script, including in
`--deploy` mode. It never creates a service, registry, secret, IAM binding,
volume, database, or enables an API. The human performs any eventual deployment.
AWS AgentCore (#78) was removed by [prompt.md §§3 and 6](../prompt.md).

## Needs you: durable journal storage

The existing publisher uses `node:sqlite` with WAL and `BEGIN IMMEDIATE`.
The database, `publisher.db-wal`, and `publisher.db-shm` must share persistent,
writable storage with SQLite-compatible locking, shared-memory and sync
semantics. Mount permissions must permit writes by the image's `node` user
(UID/GID 1000). Preserve the journal across restarts and image versions.

A path named `/mnt/journal` is not proof of durability:

- [Cloud Run local filesystem](https://docs.cloud.google.com/run/docs/container-contract#file_system)
  loses its contents when the instance stops. In-memory/ephemeral volumes
  cannot preserve settlement identities across restarts.
- [Cloud Storage FUSE](https://docs.cloud.google.com/run/docs/configuring/services/cloud-storage-volume-mounts#limitations)
  lacks file locking and full POSIX semantics. Do not put this WAL journal on it.
- [Cloud Run NFS mounts](https://docs.cloud.google.com/run/docs/configuring/services/nfs-volume-mounts#limitations)
  use no-lock mode. They are not a qualified solution for this SQLite WAL journal.

No supported durable option has been qualified for the current Cloud Run
publisher. Merely supplying a configuration file or setting max instances to 1
must not bypass this blocker. The container refuses startup when `K_SERVICE`
is set, even if deployed outside this script. Do not remove that guard until
a reviewed storage integration satisfies the one-charge-per-intent gate.

The human must supply a **pre-existing** SQLite WAL-compatible persistent
volume and service configuration, plus evidence that settlements survive
container replacement and retries with the same intent. Qualify locking during
revision overlap as well: [max instances](https://docs.cloud.google.com/run/docs/configuring/max-instances)
is a scaling limit, not an exclusive-writer lock. This package does not change
the journal, add a framework/database, or provision storage to solve this.
If that requires a different hosting/storage design, leave Cloud Run unused
for the demo and retain the local publisher. This is a Needs you item for the
orchestrator's STATUS.md; this worker does not edit that file.

## Reproducible build inputs

`Dockerfile.publisher` pins Node 24.0.0 (supports `node:sqlite`) and installs
from `package-lock.json`, retaining the existing `tsx` devDependency. No new
package is added. Root install hooks are skipped; esbuild's install script is
run explicitly. The image contains only publisher code, shared contracts,
corpus and locked dependencies. The `.dockerignore` allowlist excludes env
files, local databases, reports and credentials. Do not pass secrets as build
arguments. A release operator should additionally pin the base tag to its
verified image digest for byte-identical base selection; no image lookup,
pull, build or push was performed by this worker.

The entrypoint passes `PUBLISHER_JOURNAL_PATH` explicitly to
`createPublisherApp`, because the existing standalone server does not read
that variable. It validates the port, disables faults regardless of incoming
environment, loads/validates the corpus before listening on `0.0.0.0:$PORT`,
and handles SIGTERM/SIGINT. `/health` and the Docker health check wait for the
validated corpus. An eventual Cloud Run configuration must also use an HTTP
startup probe at `/health` on port 8080; Docker HEALTHCHECK is not a Cloud Run
probe configuration.

## Offline dry run

Use a clean committed checkout. These identifiers are examples, not resources
created by this package. No secret values belong in the script environment.

```bash
export PROJECT_ID=existing-demo-project
export REGION=asia-southeast1
export SERVICE=research-publisher
export IMAGE=asia-southeast1-docker.pkg.dev/existing-demo-project/existing-repo/publisher
export IMAGE_VERSION="$(git rev-parse HEAD)"
export PUBLISHER_SECRET_RESOURCE=projects/123456789012/secrets/publisher-secret
export PUBLISHER_SECRET_VERSION=1
export MAX_INSTANCES=1
export JOURNAL_MOUNT=/mnt/journal
export PUBLISHER_JOURNAL_PATH=/mnt/journal/publisher.db
unset PUBLISHER_SECRET
scripts/deploy-publisher.sh --dry-run
```

A successful dry run prints human-only build/push commands and an explicit
**deployment withheld** notice. It validates project, region, service, image,
source version, journal path, max instances, fault flag and the pinned secret
reference. It cannot confirm online existence or access without cloud calls.

To inspect a human-supplied offline v1 Cloud Run Service JSON export:

```bash
export SERVICE_CONFIG_JSON=/absolute/path/to/existing-service.json
scripts/deploy-publisher.sh --deploy
```

The preflight checks the configured journal path and its mounted volume. It
rejects missing/read-only, ephemeral, secret, NFS, GCS FUSE and unknown volumes.
Every current configuration exits 2 with Needs you; no deploy command runs or
is printed for copying around this guard. Invalid inputs also exit 2, without
reflecting supplied values. A future reviewed preflight must validate all
service settings and actual compatible storage before enabling deployment.

## Eventual human deployment configuration

After storage qualification, require an existing service and registry,
Linux amd64 image pinned by digest, max instances 1 (service and revision),
no traffic to old writer revisions, faults disabled, journal path on that
qualified volume, port 8080 and `/health` startup probe. Use an existing service
identity with access to the existing secret; do not create IAM resources here.

Inject `PUBLISHER_SECRET` through a [Secret Manager resource reference](https://docs.cloud.google.com/run/docs/configuring/services/secrets),
for example the configuration equivalent of
`PUBLISHER_SECRET=projects/123456789012/secrets/publisher-secret:1`.
This is a resource reference, never a literal key; use a numeric version.
Keep `PUBLISHER_PORT` unset so the managed `PORT` controls listening.

After a verified deployment, set the API's existing `PUBLISHER_URL` to the
service's HTTPS `.run.app` URL. Its existing badge detects Cloud Run from that
URL; no API/UI edit is needed. The publisher health payload currently says
`local`; location display comes from the API configuration. Settlement remains
`SIMULATED SGD · no real funds`. Until then, keep the default
`http://127.0.0.1:8790` and use `npm run demo` as the local fallback.

For a human-only local container smoke, bind an existing host journal directory
to `/mnt/journal`, pass `PUBLISHER_JOURNAL_PATH=/mnt/journal/publisher.db`, and
inject `PUBLISHER_SECRET` at runtime from an untracked env file. Use an ephemeral
host port; never bake that file into the image. The local operator is responsible
for the bind mount's persistence. This worker runs no Docker container or cloud
command.
