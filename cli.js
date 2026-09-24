#!/usr/bin/env node

const { spawn } = require('node:child_process');

const API_URL = (process.env.SNIP_API || 'http://localhost:3000').replace(/\/+$/, '');

function usage() {
  console.log(`Usage:
  snip add <url>    Create a short link
  snip ls            List saved links
  snip open <code>  Open a short link in the browser`);
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function responseError(response) {
  try {
    const body = await response.json();
    return body.error || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

async function add(url) {
  if (!isHttpUrl(url)) throw new Error('Please provide a valid http(s) URL.');

  const response = await fetch(`${API_URL}/api/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) throw new Error(await responseError(response));

  const link = await response.json();
  console.log(link.shortUrl);
}

async function list() {
  const response = await fetch(`${API_URL}/api/links`);
  if (!response.ok) throw new Error(await responseError(response));

  const links = await response.json();
  if (links.length === 0) {
    console.log('No links yet.');
    return;
  }

  const codeWidth = Math.max(4, ...links.map((link) => link.code.length));
  const hitsWidth = Math.max(4, ...links.map((link) => String(link.hits).length));
  console.log(`${'CODE'.padEnd(codeWidth)}  ${'HITS'.padStart(hitsWidth)}  URL`);
  console.log(`${'-'.repeat(codeWidth)}  ${'-'.repeat(hitsWidth)}  ---`);
  for (const link of links) {
    console.log(`${link.code.padEnd(codeWidth)}  ${String(link.hits).padStart(hitsWidth)}  ${link.url}`);
  }
}

function openBrowser(target) {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', target], { detached: true, stdio: 'ignore' }).unref();
  } else {
    const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
    spawn(command, [target], { detached: true, stdio: 'ignore' }).unref();
  }
}

async function open(code) {
  if (!code) throw new Error('Please provide a short code.');

  const response = await fetch(`${API_URL}/${encodeURIComponent(code)}`, {
    redirect: 'manual',
  });
  if (response.status === 404) throw new Error('Unknown short code.');
  if (response.status !== 302) throw new Error(`Expected a redirect, got status ${response.status}.`);

  const target = response.headers.get('location');
  if (!target) throw new Error('The backend returned a redirect without a Location header.');
  openBrowser(target);
  console.log(`Opening ${target}`);
}

async function main() {
  const [command, value] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    usage();
    return;
  }

  if (command === 'add') {
    if (!value) throw new Error('Usage: snip add <url>');
    await add(value);
    return;
  }
  if (command === 'ls') {
    await list();
    return;
  }
  if (command === 'open') {
    await open(value);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});