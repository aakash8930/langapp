import { spawnSync } from 'node:child_process';

/**
 * Expo 57 currently carries three advisories in developer-controlled build
 * tooling. Keep this list at advisory granularity: a new advisory anywhere in
 * the transitive graph fails even if it arrives through an already-listed
 * package name.
 */
const allowedAdvisories = new Set([
  1138808, // image-size ICNS parser infinite-loop DoS
  1138809, // image-size JXL/HEIF parser infinite-loop DoS
  1119441, // uuid v3/v5/v6 caller-provided buffer bounds check
]);

const result = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
if (!result.stdout) {
  console.error(result.stderr || 'npm audit returned no JSON');
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error('npm audit returned invalid JSON');
  console.error(result.stdout);
  process.exit(1);
}

const advisories = new Map();
for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vulnerability.via ?? []) {
    if (typeof via === 'object' && typeof via.source === 'number') {
      advisories.set(via.source, via);
    }
  }
}

const unexpected = [...advisories.entries()].filter(([id]) => !allowedAdvisories.has(id));
const stale = [...allowedAdvisories].filter((id) => !advisories.has(id));
if (unexpected.length) {
  for (const [id, advisory] of unexpected) {
    console.error(`Unexpected production advisory ${id}: ${advisory.title}`);
  }
  process.exit(1);
}

const counts = report.metadata?.vulnerabilities ?? {};
console.log(
  `Expo production audit: ${counts.total ?? 0} propagated findings; ` +
  `${advisories.size} reviewed build-tool advisories allowed.`,
);
if (stale.length) {
  console.log(`Resolved advisory ids can now be removed from the allowlist: ${stale.join(', ')}`);
}
