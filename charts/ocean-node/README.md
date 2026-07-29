# ocean-node Helm chart

Deploys [Ocean Node](https://github.com/oceanprotocol/ocean-node) to Kubernetes.

## Prerequisites

- Kubernetes v1.29+
- Helm 3
- An externally reachable Elasticsearch (or other supported `DB_TYPE`) instance;
  this chart does not deploy a database.

## Known limitations

- **Single replica only.** Ocean Node keeps node identity/state, a SQLite bucket
  registry, and persistent-storage files on local disk. `replicaCount` above `1`
  against a shared PVC is not supported without externalizing that state first.
- **Compute-to-Data (C2D) is off by default.** Enabling `compute.enabled` mounts
  the host's `/var/run/docker.sock` into the pod, which grants the pod effective
  root on the node and only works on Docker-based (not containerd-only) node
  pools. Do not enable this without confirming the target cluster supports it.
- **Secrets in values.** By default `secretEnv.*` values are rendered into a
  Kubernetes `Secret` by this chart. For production, set `existingSecret` to the
  name of a Secret populated by your secrets manager instead of storing
  `PRIVATE_KEY` and other credentials in a values file.

## Installing

```bash
helm install ocean-node ./charts/ocean-node \
  --set secretEnv.PRIVATE_KEY=<your_private_key> \
  --set env.DB_URL=http://elasticsearch:9200 \
  --set secretEnv.DB_USERNAME=elastic \
  --set secretEnv.DB_PASSWORD=<your_elastic_password> \
  --set env.RPCS='{"11155111":{"rpc":"https://<rpc>","chainId":11155111,"network":"sepolia","chunkSize":50,"startBlock":10347788}}'
```

Or with a values file:

```bash
helm install ocean-node ./charts/ocean-node -f my-values.yaml
```

## Upgrading / uninstalling

```bash
helm upgrade ocean-node ./charts/ocean-node -f my-values.yaml
helm uninstall ocean-node
```

Both are idempotent: re-running `helm upgrade` with the same values is a no-op,
and `helm uninstall` removes all objects created by the chart (the PVC is only
removed if it was created by the chart, i.e. `persistence.existingClaim` was
not set).

## Key values

See [values.yaml](values.yaml) for the full list. Notable ones:

| Key | Description |
|---|---|
| `image.repository` / `image.tag` | Container image (defaults to `Chart.appVersion`) |
| `env.*` | Non-secret env vars, rendered into a ConfigMap |
| `secretEnv.*` | Secret env vars (`PRIVATE_KEY` is mandatory), rendered into a Secret |
| `existingSecret` | Use a pre-existing Secret instead of `secretEnv` |
| `ingress.enabled` / `ingress.host` / `ingress.tls.*` | Expose the HTTP API (port 8000) via Ingress |
| `persistence.enabled` / `persistence.size` / `persistence.existingClaim` | PVC backing `logs/`, `databases/`, `c2d_storage/` |
| `compute.enabled` | Mount host Docker socket for C2D (see limitations above) |

Full env var reference: see `docs/env.md` in the main ocean-node repository.
