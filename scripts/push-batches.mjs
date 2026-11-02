#!/usr/bin/env node
// Run from the repository: node scripts/push-batches.mjs [--dry-run]
// Default: 5 commits per push, 3 attempts per batch, 180s per Git command.
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  'dry-run': { type: 'boolean', default: false },
  remote: { type: 'string', default: 'origin' },
  branch: { type: 'string' },
} });
const batchSize = 5;
const attempts = 3;
const timeoutMs = 180_000;

function git(args, stream = false) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      stdio: ['ignore', stream ? 'inherit' : 'pipe', stream ? 'inherit' : 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      windowsHide: true,
    });
    let stdout = '', stderr = '', timedOut = false;
    child.stdout?.on('data', data => { stdout += data; });
    child.stderr?.on('data', data => { stderr += data; });
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0 && !timedOut) resolve(stdout.trim());
      else reject(new Error(timedOut ? 'Git timed out after 180s.' : `git ${args[0]} failed (${code}). ${stderr.trim()}`));
    });
  });
}

async function main() {
  const remote = values.remote;
  const branch = values.branch ?? await git(['symbolic-ref', '--quiet', '--short', 'HEAD']);
  await git(['check-ref-format', `refs/heads/${branch}`]);
  const destination = `refs/heads/${branch}`;
  const target = await git(['rev-parse', '--verify', `${destination}^{commit}`]);
  // Resolve a configured remote, not an arbitrary URL/option supplied as a name.
  await git(['remote', 'get-url', '--push', '--', remote]);
  const pushUrls = (await git(['remote', 'get-url', '--push', '--all', '--', remote])).split('\n');
  if (pushUrls.length !== 1) throw new Error('Multiple push URLs are unsupported.');
  const pushUrl = pushUrls[0];
  let batch = 0;
  async function remaining() {
    // Query the push destination: fetch URL and push URL may differ.
    const ref = await git(['ls-remote', '--heads', '--', pushUrl, destination]);
    if (!ref) throw new Error(`Remote branch ${branch} does not exist; refusing an initial history upload.`);
    const tip = ref.split(/\s+/)[0];
    if (!/^[a-f0-9]{40,64}$/.test(tip)) throw new Error('Invalid remote commit ID.');
    try { await git(['cat-file', '-e', `${tip}^{commit}`]); }
    catch { await git(['fetch', '--no-tags', '--', pushUrl, destination]); }
    try { await git(['merge-base', '--is-ancestor', tip, target]); }
    catch { throw new Error('Remote history has diverged or advanced beyond the frozen target; stopped without force pushing.'); }
    const commits = (await git(['rev-list', '--reverse', '--topo-order', `${tip}..${target}`])).split('\n').filter(Boolean);
    if (await git(['rev-list', '--merges', `${tip}..${target}`])) {
      throw new Error('Outgoing history contains merges; refusing to exceed the five-commit batch limit.');
    }
    return commits;
  }
  const initial = await remaining();
  console.log(`Target ${branch}@${target.slice(0, 8)}; ${initial.length} commits; batch size ${batchSize}.`);
  if (values['dry-run']) {
    for (let i = 0; i < initial.length; i += batchSize) {
      const chunk = initial.slice(i, i + batchSize);
      console.log(`Batch ${i / batchSize + 1}: ${chunk.length} commits -> ${chunk.at(-1).slice(0, 8)}`);
    }
    return;
  }
  while (true) {
    let succeeded = false;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const commits = await remaining();
        if (!commits.length) { console.log('Done: remote matches the target.'); return; }
        const chunk = commits.slice(0, batchSize);
        console.log(`Batch ${batch + 1}, attempt ${attempt}/${attempts}: ${chunk.length} commits -> ${chunk.at(-1).slice(0, 8)} (${commits.length} remaining)`);
        await git(['push', '--progress', '--no-follow-tags', '--', remote, `${chunk.at(-1)}:${destination}`], true);
        batch++;
        succeeded = true;
        break;
      } catch (error) {
        console.error(error.message);
        if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    if (!succeeded) throw new Error('Stopped after three attempts. Run the same command to resume from the remote tip.');
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
