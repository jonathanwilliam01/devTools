import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
let commit = process.env.VERCEL_GIT_COMMIT_SHA ?? '';
if (!commit) {
  try {
    commit = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {}
}
const versao = { numero: version, commit: commit.slice(0, 7), data: new Date().toISOString() };
writeFileSync('src/app/versao.ts', `export const VERSAO = ${JSON.stringify(versao)};\n`);
