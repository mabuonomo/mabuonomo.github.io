---
name: super-mario-pixel-theme
description: Design and content guidelines for mabuonomo.github.io — dark-mode engineering portfolio with playful 8-bit Super Mario pixel-art accents, Matrix portrait effect, and Mario Buonomo's Staff Engineer stack.
---

# Mario Buonomo Website Theme & Identity

Use this skill whenever editing or extending `mabuonomo.github.io`.

## 1. Visual & Playful Identity
- **Base theme:** Dark mode (`#0b0c0e` background, `#14161b` / `#17181a` surfaces, `#eef0f3` ink, `#3b57ff` primary accent) built with Astro 5 (`output: 'static'`).
- **8-bit Super Mario pixel-art accents (inline SVG, `shape-rendering="crispEdges"`):**
  - Never rely on external hotlinked GIFs (e.g. Pinterest) that can break.
  - **Logo & Favicon:** Animated 8-bit Super Mario Mushroom (`.mark--mario` in `BaseLayout.astro` and `public/favicon.svg`) with `mario-idle` continuous bounce/tilt and `mario-hop` on hover.
  - **Hero Kicker:** Blinking green dot (`#22c55e`) + interactive 8-bit `?` block (`.mario-pixel-btn`) that pops `1-UP!` / `★ STAR!` on click.
  - **Primary CTA Buttons (`.btn--primary`):** Playful 3D arcade bevel (`box-shadow: 0 4px 0 #1e32a8`) with animated 8-bit Super Star icon (`.mario-star-icon`) inside `Contact Mario` buttons.
  - Always respect `@media (prefers-reduced-motion: reduce)` for all animations.
- **Matrix Portrait (`#matrix-portrait` in `src/pages/index.astro`):**
  - Keep `profile.jpg` underneath with a dark Matrix green grade (`brightness(0.72) contrast(1.24)`) so Mario's face remains recognizable.
  - Render transparent `<canvas>` overlay (`ctx.clearRect`, `cell = 7`) with dark-green pixel blocks and fast-falling Matrix rain (`48ms` tick).

## 2. Bio, Stack & Content Rules
- **Role:** `Staff Engineer @ Facile.it`, based in `Milan, Italy` (from Naples).
- **Core Stack:** TypeScript, Node.js, PHP (Symfony), NestJS, gRPC, GraphQL, Kubernetes / K3s, Docker, Traefik, GitOps CI/CD, RabbitMQ, InfluxDB, Grafana, **BLE 5.0, ESP32 & Smart Home** (Arduino, MicroPython, Home Assistant, Extended Advertising, GATT OTA, ESP-NOW, MQTTS), **Applied AI & LLM Agents** (LangChain, LangGraph, Ollama, MLflow), Python, and Android (Kotlin / Jetpack Compose).
- **Do NOT include:** Go (Golang) or any private/internal company hostnames, farm names, or MAC addresses.
- **Quote & Footer:** Arthur C. Clarke quote in `#approach`, and `Made with ❤️ in Italy · Milan` in the footer alongside GitHub, LinkedIn, Twitter, Instagram, Facebook, and Email links.
