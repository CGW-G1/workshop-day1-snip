import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundleDir = join(repoRoot, 'bundle');
const frontendDir = join(repoRoot, 'frontend');
const browserDir = join(frontendDir, 'dist', 'snip-frontend', 'browser');
const push = process.argv.includes('--push');

function run(command, args, cwd, allowedExitCodes = []) {
  return new Promise((resolveProcess, reject) => {
    const useShell = process.platform === 'win32' && (command === 'npm.cmd' || command === 'npx.cmd');
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, NG_CLI_ANALYTICS: 'false' },
      shell: useShell,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 || allowedExitCodes.includes(code)) {
        resolveProcess(code);
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

async function hasFile(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function stagedChanges(directory) {
  return (await run('git', ['diff', '--cached', '--quiet'], directory, [1])) === 1;
}

async function buildFrontend() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  await run(npm, ['install'], frontendDir);
  await run(npx, ['ng', 'build'], frontendDir);
  if (!(await hasFile(join(browserDir, 'index.html')))) {
    throw new Error(`Angular build output is missing: ${join(browserDir, 'index.html')}`);
  }
}

async function assembleBundle() {
  await rm(join(bundleDir, 'public'), { recursive: true, force: true });
  await mkdir(join(bundleDir, 'public'), { recursive: true });
  await cp(join(browserDir), join(bundleDir, 'public'), { recursive: true });
  await cp(join(repoRoot, 'backend', 'server.js'), join(bundleDir, 'server.js'));
  await cp(join(repoRoot, 'cli', 'cli.js'), join(bundleDir, 'cli.js'));
  await writeFile(join(bundleDir, '.env'), 'PUBLIC_DIR=./public\n');
  await writeFile(
    join(bundleDir, 'package.json'),
    `${JSON.stringify({
      name: 'snip-bundle',
      version: '1.0.0',
      private: true,
      scripts: { start: 'bun server.js' },
    }, null, 2)}\n`,
  );
  await writeFile(
    join(bundleDir, 'Dockerfile'),
    'FROM oven/bun:1-alpine\nCOPY . .\nENV PORT=3000\nEXPOSE 3000\nCMD bun server.js\n',
  );
  await writeFile(
    join(bundleDir, '.dockerignore'),
    '.git\n.gitmodules\nnode_modules\ndist\n',
  );
  await writeFile(
    join(bundleDir, 'railway.json'),
    `${JSON.stringify({
      '$schema': 'https://railway.app/railway.schema.json',
      build: { builder: 'DOCKERFILE' },
    }, null, 2)}\n`,
  );
}

async function commitBundle() {
  await run('git', ['add', '-A'], bundleDir);
  if (!(await stagedChanges(bundleDir))) {
    console.log('bundle: unchanged');
    return false;
  }
  await run('git', ['commit', '-m', 'Rebuild generated bundle'], bundleDir);
  return true;
}

async function updateMainPointers() {
  await run('git', ['add', 'backend', 'frontend', 'cli', 'bundle'], repoRoot);
  if (!(await stagedChanges(repoRoot))) {
    console.log('main: unchanged');
    return false;
  }
  await run('git', ['commit', '-m', 'Bump source and bundle submodules'], repoRoot);
  return true;
}

await run('git', ['submodule', 'update', '--init', '--remote', 'backend', 'frontend', 'cli'], repoRoot);
await buildFrontend();
await assembleBundle();
const bundleChanged = await commitBundle();
const mainChanged = await updateMainPointers();

if (push) {
  await run('git', ['push', 'origin', 'HEAD:bundle'], bundleDir);
  await run('git', ['push', 'origin', 'main'], repoRoot);
} else if (!bundleChanged && !mainChanged) {
  console.log('Nothing to commit. Re-run with --push to publish if needed.');
}