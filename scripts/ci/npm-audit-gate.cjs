#!/usr/bin/env node
/**
 * Fails like `npm audit --audit-level=high`, except for advisories listed (with a reason and an expiry) in
 * npm-audit-allowlist.json next to package.json. Any other high or critical finding, or an expired entry, fails.
 *
 * Usage (from the frontend directory): node ../scripts/ci/npm-audit-gate.cjs
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const BLOCKING = new Set(['high', 'critical']);
const today = new Date().toISOString().slice(0, 10);

function loadAllowlist() {
  const file = path.join(process.cwd(), 'npm-audit-allowlist.json');
  if (!fs.existsSync(file)) return new Map();
  const entries = JSON.parse(fs.readFileSync(file, 'utf8')).advisories || [];
  return new Map(entries.map((entry) => [entry.id, entry]));
}

function runAudit() {
  try {
    return execFileSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    // npm audit exits non-zero when it finds anything; the JSON is still on stdout.
    if (error.stdout) return error.stdout;
    throw error;
  }
}

function advisoryId(via) {
  const match = /GHSA-[\w-]+/.exec(via.url || '');
  return match ? match[0] : String(via.source);
}

const allowlist = loadAllowlist();
const report = JSON.parse(runAudit());
const failures = [];
const accepted = new Set();

for (const [name, vulnerability] of Object.entries(report.vulnerabilities || {})) {
  if (!BLOCKING.has(vulnerability.severity)) continue;
  // Only the packages that carry the advisory decide; dependents (string `via`) inherit from them.
  for (const via of vulnerability.via.filter((item) => typeof item === 'object')) {
    if (!BLOCKING.has(via.severity)) continue;
    const id = advisoryId(via);
    const entry = allowlist.get(id);
    if (!entry) {
      failures.push(`${name}: ${via.severity} ${id} — ${via.title}`);
    } else if (entry.expires < today) {
      failures.push(`${name}: allowlist entry for ${id} expired on ${entry.expires}; review it`);
    } else {
      accepted.add(`${id} (${entry.package}, until ${entry.expires})`);
    }
  }
}

for (const id of accepted) console.log(`accepted: ${id}`);
if (failures.length) {
  console.error('npm audit gate failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('npm audit gate passed: no unaccepted high or critical advisories.');
