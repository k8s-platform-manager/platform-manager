# platform-manager docs

Documentation site for Platform Manager, built with [Astro Starlight](https://starlight.astro.build).

## Project structure

```
.
├── public/
├── src/
│   ├── content/
│   │   └── docs/
│   │       ├── index.mdx        # Home page
│   │       └── rfcs/            # Requests for Comments
│   └── content.config.ts
├── astro.config.mjs
└── package.json
```

Starlight looks for `.md` or `.mdx` files in `src/content/docs/`. Each file is exposed as a route based on its file name. RFCs are numbered (`rfc0001-...`, `rfc0002-...`) to preserve reading order in the sidebar.

## Commands

Run from this `docs/` directory:

| Command           | Action                                       |
| :----------------- | :-------------------------------------------- |
| `npm install`      | Install dependencies                          |
| `npm run dev`       | Start local dev server at `localhost:4321`    |
| `npm run build`     | Build the production site to `./dist/`        |
| `npm run preview`   | Preview the build locally before deploying    |

## Deployment

Pushes to `main` that touch `docs/**` are built and published to GitHub Pages automatically via [`.github/workflows/deploy-docs.yml`](../.github/workflows/deploy-docs.yml). Enable GitHub Pages for this repository with source set to "GitHub Actions" for the workflow to publish successfully.
