#!/usr/bin/env node
// Runs the suite one MODULE (tests/<folder>) at a time, each with its own separate report, instead of one combined
// report for everything. Uses playwright.regression.config.ts (Firefox, 1 worker, 1 retry, action caps) and points
// its reporters at per-module paths via the env vars that config already reads.
//
// Per module <key> it produces:
//   playwright-report-<key>/            Playwright HTML report (screenshots/video/trace included)
//   regression-results-<key>.json       raw JSON results
//   test-results-<key>/                 test artifacts
//   reports/<key>/fasah-<key>-<date>.html             archived copy of the HTML report (index.html only)
//   reports/<key>/fasah-<key>-test-cases-<date>.html  test-case # -> status summary
//
// Usage:
//   node scripts/run-module.js <module> [more modules...] [--headed] [--include-slow] [-- extra playwright args]
//   node scripts/run-module.js all          every module, one after another, each with its own report
//   node scripts/run-module.js --list       show the module keys
//
// Modules run SEQUENTIALLY on purpose: several modules share the same portal accounts (ffw11 is used by both
// Delivery Order and Freight Forwarder, b3078 by nearly everything) - use run-regression-parallel.sh for a
// parallel, account-bucketed full run.
//
// --include-slow: Import Manifest's ECL "#40-43" (~20 min, historically flaky) is skipped by default in module
// runs; pass this flag to include it.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG = 'playwright.regression.config.ts';
const PLAYWRIGHT_CLI = require.resolve('@playwright/test/cli');

const MODULES = {
  import: { folder: 'Import Manifest', grepInvert: '#40-43' },
  export: { folder: 'Export Manifest' },
  transit: { folder: 'Transit Manifest' },
  delivery: { folder: 'Delivery Order' },
  ffw: { folder: 'Freight Forwarder' },
  login: { folder: 'Login' },
};

function parseArgs(argv) {
  const sep = argv.indexOf('--');
  const own = sep === -1 ? argv : argv.slice(0, sep);
  const extra = sep === -1 ? [] : argv.slice(sep + 1);
  return {
    modules: own.filter((a) => !a.startsWith('--')),
    headed: own.includes('--headed'),
    includeSlow: own.includes('--include-slow'),
    list: own.includes('--list'),
    extra,
  };
}

function printModules() {
  console.log('Modules:');
  for (const [key, { folder }] of Object.entries(MODULES)) console.log(`  ${key.padEnd(10)} tests/${folder}`);
  console.log('  all        every module above, one after another');
}

function runModule(key, { headed, includeSlow, extra }) {
  const mod = MODULES[key];
  const date = new Date().toISOString().slice(0, 10);
  const htmlDir = `playwright-report-${key}`;
  const jsonFile = `regression-results-${key}.json`;

  const args = [PLAYWRIGHT_CLI, 'test', `tests/${mod.folder}/`, `--config=${CONFIG}`, '--workers=1', `--output=test-results-${key}`];
  if (headed) args.push('--headed');
  if (mod.grepInvert && !includeSlow) args.push(`--grep-invert=${mod.grepInvert}`);
  args.push(...extra);

  console.log(`\n=== Module: ${key} (tests/${mod.folder}) ===`);
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      PLAYWRIGHT_HTML_REPORT: htmlDir,
      PLAYWRIGHT_JSON_OUTPUT_NAME: jsonFile,
      PLAYWRIGHT_BLOB_OUTPUT_DIR: `blob-report-${key}`,
    },
  });
  const code = result.status ?? 1;
  if (extra.includes('--list')) return code; // dry run - nothing ran, so nothing to archive

  const outDir = path.join(ROOT, 'reports', key);
  fs.mkdirSync(outDir, { recursive: true });
  const htmlIndex = path.join(ROOT, htmlDir, 'index.html');
  if (fs.existsSync(htmlIndex)) fs.copyFileSync(htmlIndex, path.join(outDir, `fasah-${key}-${date}.html`));
  if (fs.existsSync(path.join(ROOT, jsonFile))) {
    spawnSync(process.execPath, [
      path.join(__dirname, 'generate-test-case-report.js'),
      jsonFile,
      '-o',
      path.join('reports', key, `fasah-${key}-test-cases-${date}.html`),
    ], { cwd: ROOT, stdio: 'inherit' });
  }

  console.log(`Module ${key} finished with exit code ${code}. Report: npx playwright show-report ${htmlDir}`);
  return code;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.list || opts.modules.length === 0) {
    printModules();
    process.exit(opts.list ? 0 : 1);
  }

  const keys = opts.modules.includes('all') ? Object.keys(MODULES) : opts.modules;
  const unknown = keys.filter((k) => !MODULES[k]);
  if (unknown.length) {
    console.error(`Unknown module(s): ${unknown.join(', ')}`);
    printModules();
    process.exit(1);
  }

  const results = keys.map((key) => [key, runModule(key, opts)]);

  console.log('\n=== Summary ===');
  for (const [key, code] of results) console.log(`  ${key.padEnd(10)} ${code === 0 ? 'PASSED' : `FAILED (exit ${code})`}  -> playwright-report-${key}/`);
  process.exit(results.some(([, code]) => code !== 0) ? 1 : 0);
}

main();
