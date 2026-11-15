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

If you run workloads outside a hyperscaler — on bare-metal servers, edge appliances, or modest multi-node setups — **K3s** hits a sweet spot. It gives you real Kubernetes APIs, scheduling, and ingress without burning half your RAM on control-plane overhead.

That said, running stateful services like **RabbitMQ**, **MySQL**, and **Redis** on smaller clusters quickly exposes every weak assumption in default manifests. A single power blink or CNI hiccup will test your architecture immediately.

![Resilient K3s Cluster with GitOps, RabbitMQ and Grafana](/assets/images/blog/k3s-gitops-grafana.jpg)

## GitOps as Your Safety Net

When a node has to be rebuilt, the worst place for configuration to live is in someone's bash history. Treating the Git repository as the single source of truth via **Kustomize** and GitOps sync means every namespace, secret reference, `Traefik` ingress, and `PodDisruptionBudget` is reproducible.

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
```

A simple `PodDisruptionBudget` like this stops node drains or rolling upgrades from taking down two broker replicas at the same time and breaking cluster quorum.

## Hardening Stateful Services Against Node Restarts

Most painful outages on small clusters don't come from application bugs — they come from **unclean reboots** and **split-brain recovery**. A few defensive habits eliminate 90% of the late-night firefighting:

| Component | Common Failure Mode | Practical Fix |
| :--- | :--- | :--- |
| **RabbitMQ** | Classic mirrored queue split-brain | Use **Quorum Queues** (`x-queue-type: quorum`) |
| **MySQL / Redis** | Readiness probe passes before quorum sync | Check replication/quorum state inside the probe |
| **Flannel / CNI** | Stale VXLAN/host routes after reboot | Run a lightweight watchdog DaemonSet |
| **Node Disk** | Container logs & images trigger eviction | Enforce `kubelet` GC thresholds + log rotation |

> **Rule of thumb:** Never let a database or message broker report `Ready` just because TCP port `3306` or `5672` is open. Verify that it has actually rejoined its cluster before traffic or consumers hit it.

## Observability That Points Straight to the Fix

Dashboards are only useful when they tell you **what broke** in under 30 seconds. Pairing **Prometheus** (`node-exporter`, `kube-state-metrics`, RabbitMQ and DB exporters) with **Grafana** alerts gives you early warning before users notice:

- **Consumer lag & unacknowledged messages** rising faster than drain rate
- **Replica lag or read-only replica flips** after a network blip
- **Pod restart loops** and node memory pressure

Better yet, link every Grafana alert directly to a short, tested **Markdown runbook** right inside your GitOps repository. When something pages you, having the exact verification and recovery commands one click away turns a stressful incident into a calm checklist.
