# Argo CD GitOps setup for ocean-node

This directory wires up GitOps deployment of the [ocean-node Helm chart](../charts/ocean-node)
via Argo CD. It is not tied to any specific cloud provider — the one environment
defined out of the box (`exoscale`) targets the project's current Exoscale
cluster, but nothing here assumes IONOS Cloud, T-Systems OSC, Exoscale, or any
other provider by name.

## Files

| File | Purpose |
|---|---|
| `appproject.yaml` | Argo CD `AppProject` scoping what the ocean-node Applications may touch (this repo only, `ocean-node*` namespaces, a fixed resource whitelist) |
| `applicationset.yaml` | Argo CD `ApplicationSet` that generates one `Application` per environment/cluster entry |
| `values/<env>.yaml` | Per-environment Helm values overlay, merged on top of `charts/ocean-node/values.yaml` |
| `external-secret.yaml` | External Secrets Operator `SecretStore`/`ExternalSecret` that syncs `ocean-node-secrets` from OpenBao — see below |

## Prerequisites

- Argo CD installed and reachable (either in the same cluster you're deploying
  to, or managing it remotely).
- The target cluster registered with Argo CD if it's not the one Argo CD itself
  runs in: `argocd cluster add <kubeconfig-context>`.
- A Secret with the node's credentials (`PRIVATE_KEY`, `DB_USERNAME`,
  `DB_PASSWORD`, `JWT_SECRET`) already present in the target namespace before
  the ocean-node Application first syncs — see `existingSecret` in
  `values/exoscale.yaml`. This chart intentionally does not commit real secret
  values to Git.
- If that Secret is sourced from OpenBao, the External Secrets Operator (ESO)
  operator itself must already be installed in the cluster — installing ESO is
  cluster infra and out of scope here. `external-secret.yaml` only adds the
  `SecretStore`/`ExternalSecret` that tell an existing ESO install where to pull
  from; see the prerequisites documented at the top of that file (OpenBao
  Kubernetes auth + role setup).

## Bootstrapping

```bash
kubectl apply -f argocd/appproject.yaml
kubectl apply -f argocd/applicationset.yaml
```

If the credentials Secret is sourced from OpenBao (see above), also apply:

```bash
kubectl apply -f argocd/external-secret.yaml
```

before the ocean-node Application's first sync, so `ocean-node-secrets` exists
in time. If you're populating the Secret another way, skip this file entirely.

Argo CD will create an `Application` named `ocean-node-exoscale` and sync it
from `charts/ocean-node` using `values/exoscale.yaml`.

## Adding another environment or cluster

Nothing here is hardcoded to a particular cluster name or provider. To add one:

1. Copy `values/exoscale.yaml` to `values/<your-env>.yaml` and adjust it
   (ingress host, storage class, DB endpoint, `existingSecret` name, etc).
2. Add one more entry to the `generators[0].list.elements` list in
   `applicationset.yaml`:
   ```yaml
   - env: <your-env>
     namespace: ocean-node-<your-env>
     server: 'https://<cluster-api-endpoint>' # or https://kubernetes.default.svc if in-cluster
     valuesFile: values/<your-env>.yaml
     targetRevision: main
   ```
3. `kubectl apply -f argocd/applicationset.yaml` — Argo CD picks up the new
   entry and creates the additional `Application` automatically.

## Sync policy

The default `syncPolicy` is intentionally conservative: `selfHeal: true` (drift
gets corrected automatically) but `prune: false` (resources removed from Git are
NOT automatically deleted from the cluster). Tighten this per environment once
you've agreed on a promotion/approval process — e.g. enable `prune: true` for
non-production, or drop `automated` entirely in favor of manual sync for
production.

## Repository note

`sourceRepos` in `appproject.yaml` and `repoURL` in `applicationset.yaml` point
at this project's repo (`https://github.com/SENSE-EU/ocean-node`) — chart,
ArgoCD manifests, and app source all live together (mono-repo GitOps).
