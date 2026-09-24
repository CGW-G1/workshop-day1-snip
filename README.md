# Snip

Snip is a tiny URL shortener with one backend and two clients: an Angular web
app and a Node CLI. The `main` branch is the superproject; each layer lives in
its own branch and is mounted here as a Git submodule.

## Layout

```text
snip-demo/
├── backend/    Bun API, branch backend
├── frontend/   Angular 19 web app, branch frontend
├── cli/        Node CLI, branch cli
└── .gitmodules
```

The submodules are pinned to exact commits, so `main` records a reproducible
combination of all three layers.

## API contract

The backend runs on `http://localhost:3000` and is shared by both clients.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/links` | `{ "url": "https://..." }` | `201` with `{ code, url, shortUrl, hits, createdAt }`; `400` for invalid input |
| `GET` | `/api/links` | None | `200` array of links |
| `GET` | `/:code` | None | `302` redirect and incremented hit count; `404` if unknown |

Storage is an in-memory `Map`, so restarting the backend clears all links by
design.

## Clone and run

Use `--recurse-submodules`; a plain clone leaves the submodule directories
empty.

```bash
git clone --recurse-submodules https://github.com/CGW-G1/workshop-day1-snip.git
cd workshop-day1-snip
```

Run the three pieces in separate terminals:

```bash
cd backend
bun start
```

```bash
cd frontend
npm install
npx ng serve
```

```bash
cd cli
node cli.js add https://example.com
node cli.js ls
node cli.js open <code>
```

Open the web app at `http://localhost:4200`.

## Updating a layer

Commit and push changes from inside the relevant submodule first, then update
the pointer from the `main` checkout:

```bash
cd backend
git add -A
git commit -m "Update backend"
git push

cd ..
git submodule update --remote backend
git add backend
git commit -m "Bump backend submodule"
git push
```

Use the same workflow with `frontend` or `cli`. The layer commit and the
superproject pointer commit are separate Git records.