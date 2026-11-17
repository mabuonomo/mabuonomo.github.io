---
title: "Running Resilient K3s Clusters with GitOps, RabbitMQ & Grafana"
date: 2026-09-24 10:00
image: /assets/images/blog/k3s-gitops-grafana.jpg
headerImage: true
lang: en
tag:
  - kubernetes
  - k3s
  - gitops
  - rabbitmq
  - grafana
category: blog
author: mabuonomo
---

If you run workloads outside a hyperscaler (on bare-metal servers, edge appliances, or a modest rack of mini PCs), **K3s** hits a sweet spot. It is a fully conformant Kubernetes distribution packaged as a single binary, with sensible batteries included: containerd, Flannel, CoreDNS, Traefik, a local-path storage provisioner and an embedded etcd option for HA. You get real Kubernetes APIs, scheduling and ingress without burning half your RAM on control-plane overhead.

Getting a K3s cluster *running* takes five minutes. Getting it to *survive* is a different job. Stateful services like **RabbitMQ**, **MySQL** and **Redis** on small clusters expose every weak assumption in default manifests, and a single power blink, a CNI hiccup or a full disk will test your architecture far more honestly than any design review.

This post collects the practices that turned our small clusters from "works until someone trips over a power cable" into something boring and predictable: GitOps as the source of truth, defensive configuration for stateful workloads, and observability that points straight to the fix.

![Resilient K3s Cluster with GitOps, RabbitMQ and Grafana](/assets/images/blog/k3s-gitops-grafana.jpg)

## Start with a Topology That Can Lose a Node

Most resilience problems are decided before the first manifest is applied. On a small cluster, the rule is simple: **three server nodes with embedded etcd**, or accept that losing the control plane means losing the cluster.

etcd needs a majority (quorum) to accept writes. With three members, you can lose one; with two, losing either one stops the API server. Two server nodes are therefore *less* available than one, which surprises a lot of people.

K3s reads its configuration from `/etc/rancher/k3s/config.yaml`, which is far easier to version and review than long command-line flags:

```yaml
# /etc/rancher/k3s/config.yaml (first server)
cluster-init: true
tls-san:
  - k3s-api.example.internal
disable:
  - servicelb            # we use MetalLB / kube-vip instead
etcd-snapshot-schedule-cron: "0 */6 * * *"
etcd-snapshot-retention: 20
kubelet-arg:
  - "image-gc-high-threshold=80"
  - "image-gc-low-threshold=60"
  - "eviction-hard=memory.available<300Mi,nodefs.available<10%,imagefs.available<10%"
  - "container-log-max-size=20Mi"
  - "container-log-max-files=3"
  - "shutdown-grace-period=60s"
  - "shutdown-grace-period-critical-pods=20s"
```

Every line in that file comes from an incident:

- **etcd snapshots** every six hours, ideally shipped off the node (K3s can upload them to any S3-compatible bucket). A cluster with no off-node etcd backup is one failed SSD away from a rebuild from scratch.
- **Image GC and eviction thresholds** keep a node from filling its disk with old images and container logs, which otherwise ends in mass pod eviction at the worst possible moment.
- **Log rotation** at the kubelet level, because a single chatty pod writing debug logs can fill a 64 GB edge disk in a weekend.
- **Graceful node shutdown** gives pods time to terminate cleanly when a node is powered off via systemd, instead of being killed mid-write.

Additional servers join with `server: https://k3s-api.example.internal:6443` and the cluster token. Put the API endpoint behind a virtual IP (kube-vip works nicely) so that clients don't care which server is alive.

## GitOps as Your Safety Net

When a node has to be rebuilt at 2 AM, the worst place for configuration to live is someone's bash history. Treating a Git repository as the **single source of truth**, continuously reconciled by **Flux** or **Argo CD**, means every namespace, ingress, secret reference and `PodDisruptionBudget` is reproducible, reviewed and auditable.

The repository layout matters more than the tool. A structure that has scaled well for us:

```text
clusters/
  edge-milan/
    kustomization.yaml        # entry point reconciled by Flux / Argo CD
    infrastructure.yaml       # points to infrastructure/overlays/edge
    apps.yaml                 # points to apps/overlays/edge
infrastructure/
  base/                       # cert-manager, ingress, monitoring, operators
  overlays/
    edge/                     # small resource requests, single replicas where OK
    datacenter/
apps/
  base/
    telemetry-consumer/
    rabbitmq/
  overlays/
    edge/
runbooks/
  rabbitmq-quorum-lost.md
  node-disk-pressure.md
```

Three principles keep this healthy:

1. **Bases describe *what*, overlays describe *where*.** Replica counts, resource requests, storage classes and hostnames belong in overlays; the shape of a deployment belongs in the base.
2. **Infrastructure reconciles before apps.** Express the dependency explicitly (Flux `dependsOn`, Argo CD sync waves) so an app never starts before its operator CRDs exist.
3. **No `kubectl apply` from laptops.** Ever. If a manual hotfix is unavoidable during an incident, the follow-up PR is part of closing the incident. Otherwise the reconciler will "fix" your fix ten minutes later.

### Secrets without secrets in Git

Plain Kubernetes `Secret` manifests are base64, not encryption. Two approaches work well with GitOps:

- **SOPS + age**: secrets are encrypted in the repository and decrypted by Flux at apply time. Diffs remain readable because only values are encrypted, not keys.
- **Sealed Secrets** or **External Secrets Operator**: either a controller-held key, or a reference to an external vault.

Whichever you choose, document the key recovery procedure in the `runbooks/` folder. A perfectly encrypted repository is useless if the only private key lived on the node that just died.

## Disruption Budgets and Spreading Replicas

Running three replicas of something buys nothing if all three land on the same node. Kubernetes will happily do that unless told otherwise.

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: rabbitmq-quorum-pdb
  namespace: messaging
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: rabbitmq
---
# in the StatefulSet pod template
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels:
        app.kubernetes.io/name: rabbitmq
```

The `PodDisruptionBudget` stops `kubectl drain` and rolling upgrades from evicting two broker replicas at once and breaking quorum. The `topologySpreadConstraints` make sure the scheduler places one replica per node in the first place. Together they turn node maintenance from a nervous ritual into a routine operation.

> **Note:** a PDB only protects against *voluntary* disruptions (drains, upgrades, autoscaling). It does nothing against a node losing power, which is exactly why replica spreading matters as much as the budget itself.

## Storage: The Part Everyone Underestimates

K3s ships with the **local-path provisioner**, which creates PersistentVolumes as directories on the node's disk. It is fast and simple, but every volume is **pinned to a single node**. If that node dies, the pod cannot be rescheduled elsewhere: it stays `Pending` until the node returns.

That is acceptable, and often ideal, for workloads that replicate data themselves: RabbitMQ quorum queues, MySQL Group Replication, Redis with Sentinel. Each replica keeps its own local copy, and the application layer handles redundancy. It is a bad fit for single-replica stateful workloads, where you either need replicated block storage (**Longhorn** is the usual choice on K3s) or a tested backup-and-restore path.

The decision table we use:

| Workload | Replicates itself? | Storage choice |
| :--- | :--- | :--- |
| RabbitMQ (quorum queues) | Yes (Raft) | local-path, one replica per node |
| MySQL Group Replication | Yes | local-path, one replica per node |
| InfluxDB / single-instance DB | No | Longhorn (2–3 replicas) + backups |
| Grafana | No, but state is small | Longhorn, or provisioned from Git |

## Hardening Stateful Services Against Unclean Restarts

Most painful outages on small clusters don't come from application bugs. They come from **unclean reboots**, **split-brain recovery** and **probes that lie**. A few defensive habits eliminate most of the late-night firefighting:

| Component | Common Failure Mode | Practical Fix |
| :--- | :--- | :--- |
| **RabbitMQ** | Classic mirrored queues diverge after a partition | Use **quorum queues** (Raft-based) |
| **MySQL / Redis** | Readiness passes before the replica rejoins | Check replication/quorum state inside the probe |
| **Flannel / CNI** | Stale VXLAN routes after an unclean reboot | Watchdog DaemonSet + alert on cross-node pod reachability |
| **Node disk** | Container logs and images trigger eviction | Kubelet GC thresholds + log rotation |
| **etcd** | Slow disk causes leader elections | SSD/NVMe, monitor `etcd_disk_wal_fsync_duration_seconds` |

### RabbitMQ: quorum queues and honest probes

Classic mirrored queues were deprecated and then removed in RabbitMQ 4.0, and for good reason: their behaviour during network partitions was difficult to reason about. **Quorum queues** replicate messages with the Raft consensus algorithm, tolerate the loss of a minority of replicas, and recover predictably.

Make them the default instead of relying on every client to declare `x-queue-type: quorum`. Set the virtual host's default queue type, either at creation time or via the **RabbitMQ Cluster Operator**'s topology resources, so a developer who forgets the argument still gets a durable queue.

The readiness probe is where many setups quietly lie. A TCP check on port `5672` passes as soon as the Erlang listener opens, long before the node has rejoined the cluster and caught up its quorum queue replicas. Use RabbitMQ's built-in health checks instead:

```yaml
readinessProbe:
  exec:
    command:
      - sh
      - -c
      - rabbitmq-diagnostics -q check_running && rabbitmq-diagnostics -q check_local_alarms
  initialDelaySeconds: 20
  periodSeconds: 15
  timeoutSeconds: 10
```

For node maintenance, use `rabbitmq-upgrade drain` in a `preStop` hook and `rabbitmq-queues check_if_node_is_quorum_critical` before taking a node down: it refuses if stopping this node would leave any quorum queue without a majority.

### MySQL and Redis: probe the cluster state, not the port

The same principle applies to databases. A MySQL Group Replication member should only report `Ready` when it is actually `ONLINE` in the group:

```sql
SELECT MEMBER_STATE
FROM performance_schema.replication_group_members
WHERE MEMBER_ID = @@server_uuid;   -- expect 'ONLINE', not 'RECOVERING'
```

For Redis with Sentinel, check `INFO replication` for `master_link_status:up` on replicas. In both cases, wrap the check in a small script, mount it via ConfigMap, and call it from the probe.

> **Rule of thumb:** never let a database or message broker report `Ready` just because TCP port `3306` or `5672` is open. Verify that it has actually rejoined its cluster before traffic or consumers hit it.

### Consumers that tolerate broker restarts

Resilient brokers do not help if consumers fall over every time a broker pod restarts. Every consumer we run follows the same rules:

- **Manual acknowledgements**, sent only *after* the message has been durably processed (written to the database, forwarded, etc.).
- **Bounded prefetch** (`basic.qos`), typically 20–100, so one slow consumer cannot hoard thousands of unacknowledged messages.
- **Reconnect with jittered exponential backoff**, re-declaring topology on reconnect.
- **Idempotent processing**, because "at least once" delivery means *at least* once: redeliveries after a restart are normal, not exceptional.
- **A dead-letter exchange** with a delivery limit (quorum queues support `delivery-limit` natively) to quarantine poison messages instead of looping forever.

## Observability That Points Straight to the Fix

Dashboards are only useful when they tell you **what broke** in under 30 seconds. Pairing **Prometheus** (`node-exporter`, `kube-state-metrics`, the RabbitMQ `rabbitmq_prometheus` plugin and database exporters) with **Grafana** gives you early warning before users notice.

The kube-prometheus-stack Helm chart is a good starting point, but on small clusters trim it aggressively: lower retention (7–15 days locally, ship long-term data elsewhere if needed), drop high-cardinality metrics you never query, and set explicit resource limits. A monitoring stack that OOM-kills the node it is monitoring is a special kind of irony.

Alerts should be few, actionable and **symptom-first**. The ones that have earned their place:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: messaging-alerts
  namespace: monitoring
spec:
  groups:
    - name: rabbitmq
      rules:
        - alert: RabbitMQUnackedGrowing
          expr: sum by (queue) (rabbitmq_queue_messages_unacked) > 5000
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: "Unacked messages piling up on {{ $labels.queue }}"
            runbook_url: "https://git.example.internal/ops/runbooks/rabbitmq-unacked.md"
        - alert: PodRestartLoop
          expr: increase(kube_pod_container_status_restarts_total[15m]) > 3
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "{{ $labels.namespace }}/{{ $labels.pod }} is restarting repeatedly"
            runbook_url: "https://git.example.internal/ops/runbooks/pod-restart-loop.md"
```

The signals worth a dashboard row each:

- **Consumer lag and unacknowledged messages** rising faster than the drain rate: the earliest sign of a stuck or slow consumer.
- **Replica lag or read-only flips** after a network blip.
- **Pod restart loops** and node memory/disk pressure.
- **etcd fsync latency and leader changes**: frequent elections almost always mean slow storage.
- **Certificate expiry** for ingress and internal TLS, because nothing says "Monday" like an expired cert.

Then link every alert to a short, tested **Markdown runbook** inside the GitOps repository, via the `runbook_url` annotation. A good runbook has three sections: *how to confirm* (exact commands), *how to mitigate* (exact commands), and *how to verify recovery*. When something pages you, having those one click away turns a stressful incident into a calm checklist.

## Practice the Failure, Not Just the Deploy

The final habit is the one that actually builds confidence: **break things on purpose**, on a schedule, while everyone is awake.

- **Pull the power** on a server node and watch: does the API stay up? Do quorum queues keep accepting messages? How long until the node rejoins?
- **Restore an etcd snapshot** into a scratch cluster once a quarter. A backup you have never restored is a hope, not a backup.
- **Fill a node's disk** in staging and check that eviction thresholds and alerts behave as expected.
- **Rebuild a node from zero** using only the Git repository and the runbooks. Time it. Every manual step you discover is a future PR.

## Wrapping Up

K3s makes Kubernetes accessible on hardware that would never run a full upstream control plane comfortably. But the distribution only gives you the primitives; resilience comes from the choices layered on top:

- **Three servers** with embedded etcd and off-node snapshots.
- **Git as the only way** configuration reaches the cluster, with encrypted secrets and documented key recovery.
- **Replicas spread** across nodes and protected by disruption budgets.
- **Storage chosen per workload**, based on whether the application replicates itself.
- **Probes that tell the truth** about cluster membership, not just open ports.
- **Alerts that link to runbooks**, and failure drills that prove the runbooks work.

None of these are exotic. Together, they are the difference between a cluster you babysit and a cluster you forget about, which, for infrastructure, is the highest compliment there is.
