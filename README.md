# Snip Backend

Snip is a tiny URL shortener powered by Bun. It uses an in-memory `Map`, so
links reset whenever the server restarts.

```bash
bun start
```

The server listens on port `3000` by default. Set `PORT`, `BASE_URL`, or
`PUBLIC_DIR` to configure it. The API supports creating links with
`POST /api/links`, listing them with `GET /api/links`, and following a short
code with `GET /:code`.