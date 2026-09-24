# Contributing

Bug reports and fixes are welcome. For anything bigger than a fix, open an [issue](https://github.com/haruhimemoe/packs.haruhime.moe/issues) first so we can agree on it.

Read [AGENTS.md](./AGENTS.md) before changing code. It has the layout, code style and data rules.

## Setup

Requires Bun 1.4+ and Node 24+.

```sh
bun install
cp .env.example .env.local
bun run dev
```

The dev server runs on http://localhost:3000. The anonymous tool (build, key, zip, torrent) works without any variables. Accounts, saved packs and the public pack list need a MongoDB database and an osu! OAuth app: fill in the first five variables in `.env.local` (each one has a comment in `.env.example`).

`bun install` also sets up a lefthook pre-commit hook that runs Biome on staged files.

## Making a change

1. Branch from `main` (`feat/<topic>`, `fix/<topic>`).
2. Write a failing test in `tests/`, make it pass, and keep commits small.
3. If people will see the change, update the copy that describes it in the same PR: the guide, the API docs, the homepage FAQ or the legal pages. AGENTS.md section 7 lists them.
4. Run the full check before opening a PR:

   ```sh
   bun run check && bun run typecheck && bun run test && SKIP_ENV_VALIDATION=true bun run build
   ```

5. Open a PR using the template. CI must be green before merge.

Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`).

Releases are cut by the maintainers.

## Tests

`bun run test` runs three Vitest projects. Run one with `bun run test:unit`, `test:components` or `test:integration`.

- `tests/unit/`: pure code, in Node, with `TZ=America/Los_Angeles`.
- `tests/components/`: React components in jsdom.
- `tests/integration/`: route handlers and services against an in-memory MongoDB (mongodb-memory-server). The first run downloads the MongoDB binary.

Tests never hit the network: HTTP is mocked with recorded fixtures in `tests/fixtures/`.

## Scripts

| Script | What it does |
| --- | --- |
| `bun run dev` | Dev server |
| `bun run build` | Production build |
| `bun run check` / `check:fix` | Biome lint, format and import order |
| `bun run typecheck` | Route type generation, then `tsc` |
| `bun run test` | All Vitest projects |
| `bun run test:coverage` | Tests with v8 coverage; fails under 90% on `src/utils/` and `src/schemas/` |

CI runs the same checks, with `test:coverage` in place of `test`.
