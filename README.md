# mabuonomo.github.io

Personal website and technical blog of **Mario Buonomo**, built as a static site with [Astro](https://astro.build/) and deployed to [GitHub Pages](https://mabuonomo.github.io).

---

## Stack

- **Framework:** [Astro 5](https://astro.build/) (`output: 'static'`)
- **Runtime:** Node.js 24
- **Containerized Dev:** Docker Compose (`node:24-alpine`)
- **Content:** Markdown blog posts via Astro Content Collections (`src/content/blog`) with Shiki (`github-dark`) syntax highlighting
- **CI/CD:** GitHub Actions (`withastro/action@v6` + `actions/deploy-pages@v4`)

---

## Local Development

### Option 1: Docker Compose (Recommended)

No local Node.js installation required.

```bash
docker compose up
```

The dev server starts inside a `node:24-alpine` container and is available at [http://localhost:4321](http://localhost:4321).

To stop and remove the container:

```bash
docker compose down
```

### Option 2: Local Node.js

Requires **Node.js 24+**.

```bash
npm install
npm run dev
```

Available scripts:

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start the local Astro dev server on port `4321` |
| `npm run build` | Build the static production site into `dist/` |
| `npm run preview` | Preview the built `dist/` output locally |

---

## Project Structure

```text
.
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions build & deploy to GitHub Pages
├── public/
│   ├── assets/                 # Static assets, styles, images, and diagrams
│   ├── favicon.svg
│   ├── robots.txt
│   └── share.jpg
├── src/
│   ├── content/
│   │   └── blog/               # Markdown blog posts (/blog/<slug>/)
│   ├── layouts/
│   │   └── BaseLayout.astro    # Shared dark-mode layout & metadata
│   ├── pages/
│   │   ├── blog/
│   │   │   ├── index.astro     # Blog archive
│   │   │   └── [slug].astro    # Dynamic blog post routes
│   │   ├── 404.astro
│   │   └── index.astro         # Home page
│   └── content.config.ts       # Content Collection Zod schema
├── astro.config.mjs
├── docker-compose.yml
└── package.json
```

---

## Adding a Blog Post

Create a `.md` file inside `src/content/blog/` (the filename becomes the URL slug under `/blog/<slug>/`):

```markdown
---
title: "Post Title"
date: 2026-01-15
category: blog
tag:
  - docker
  - devops
image: /assets/images/example.png
headerImage: true
---

Your content here...
```

Supported frontmatter fields (defined in `src/content.config.ts`):

- `title` *(required)* — Post title
- `date` *(required)* — Publication date
- `tag` — List of tags (defaults to `[]`)
- `category` — Optional category
- `image` — Optional cover image path
- `headerImage` — Optional boolean to show/hide header image
- `comments` — Optional boolean
- `lang` — Language code (defaults to `'en'`)
- `author` — Optional author name

---

## Build & Deployment

Every push to `master` (or manual `workflow_dispatch`) triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

1. Checks out the repository (`actions/checkout@v4`).
2. Installs dependencies and builds the static Astro site with Node 24 (`withastro/action@v6`).
3. Deploys the generated static bundle to GitHub Pages (`actions/deploy-pages@v4`).
