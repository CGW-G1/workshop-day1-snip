# Snip CLI

The zero-dependency `snip` command talks to the Snip backend. Node 18 or newer
is required for its built-in `fetch` implementation.

```bash
node cli.js add https://example.com
node cli.js ls
node cli.js open <code>
```

Set `SNIP_API` to use a backend other than `http://localhost:3000`. The
`snip`, `snip.cmd`, and `snip.ps1` wrappers forward arguments to `cli.js` on
Unix-like systems, Windows Command Prompt, and PowerShell respectively.