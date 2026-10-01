#!/usr/bin/env node
// Builds a "test case # -> status" summary from one or more Playwright JSON reporter outputs, cross-referenced
// against scripts/test-scenarios.json (extracted from the "Fasah - Air services - Test scenarios" spreadsheet).
//
// Playwright's JSON reporter only records pass/fail per test() (no per-step status), so a bundled test that
// carries multiple scenario numbers (e.g. "#6-9 create air delivery order...") reports the SAME status for all
// of them - if it passed, every step inside it ran and passed; if it failed, we honestly don't know how far the
// untested rest got, so they're marked with the test's own outcome rather than guessed at.
//
// Usage: node scripts/generate-test-case-report.js <results1.json> [results2.json ...] -o <output.html>

const fs = require('fs');
const path = require('path');

const SCENARIOS_PATH = path.join(__dirname, 'test-scenarios.json');

// Which spreadsheet sheet a spec file belongs to by default (a bare "#N" tag resolves against this).
// A tag can override this with an explicit prefix (e.g. "FFW#1" inside a Delivery Order file).
const FILE_SHEET_MAP = [
  { match: /^Import Manifest[\\/]linkMasterBillWithExpress\.spec\.ts$/, sheet: 'Linking Express Mail Bills' },
  { match: /^Import Manifest[\\/]/, sheet: 'Air Import Manifest' },
  { match: /^Export Manifest[\\/]/, sheet: 'Air Export Manifest' },
  { match: /^Transit Manifest[\\/]/, sheet: 'Air Transit Manifest' },
  { match: /^Delivery Order[\\/]/, sheet: 'Air Delivery Order' },
  { match: /^Freight Forwarder[\\/]/, sheet: 'FFW' },
];

// Explicit tag prefix -> sheet name (used when a title carries a cross-sheet reference like "FFW#3").
const PREFIX_SHEET_MAP = {
  FFW: 'FFW',
};

function sheetForFile(file) {
  const normalized = file.replace(/\//g, '\\').replace(/^.*?([A-Za-z ]+\\[A-Za-z]+\.spec\.ts)$/, '$1');
  for (const { match, sheet } of FILE_SHEET_MAP) {
    if (match.test(file.replace(/\\/g, '/')) || match.test(normalized)) return sheet;
  }
  return null;
}

// Parses the leading tag block off a test title, e.g. "#6-9,FFW#1 create air delivery order..."
// -> { refs: [{prefix: null, number: 6}, ..., {prefix: 'FFW', number: 1}], rest: 'create air delivery order...' }
function parseTags(title) {
  // trailing "-?" tolerates titles like "#39- Add Bills..." (a dash glued straight onto the number, not a
  // "#N-M" range) - without it, the required \s+ right after the number never matches and the whole title
  // silently falls through to the untagged bucket instead of linking to its scenario row:
  const m = title.match(/^((?:[A-Z]+)?#\d+(?:-\d+)?-?(?:,(?:[A-Z]+)?#?\d+(?:-\d+)?-?)*)\s+(.*)$/s);
  if (!m) return { refs: [], rest: title };

  const block = m[1];
  const rest = m[2];
  const refs = [];
  let currentPrefix = null;

  for (const piece of block.split(',')) {
    const withPrefix = piece.match(/^([A-Z]+)?#(\d+)(?:-(\d+))?-?$/);
    const bareNumber = piece.match(/^(\d+)(?:-(\d+))?-?$/);

    if (withPrefix) {
      currentPrefix = withPrefix[1] || null;
      const start = parseInt(withPrefix[2], 10);
      const end = withPrefix[3] ? parseInt(withPrefix[3], 10) : start;
      for (let n = start; n <= end; n++) refs.push({ prefix: currentPrefix, number: n });
    } else if (bareNumber) {
      const start = parseInt(bareNumber[1], 10);
      const end = bareNumber[2] ? parseInt(bareNumber[2], 10) : start;
      for (let n = start; n <= end; n++) refs.push({ prefix: currentPrefix, number: n });
    }
  }

  return { refs, rest };
}

function specStatus(spec) {
  const test = spec.tests && spec.tests[0];
  if (!test) return 'unknown';
  if (test.status === 'skipped') return 'skipped';
  if (test.status === 'flaky') return 'flaky';
  return spec.ok ? 'passed' : 'failed';
}

// sums every attempt's duration (ms) - a retried test's earlier failed attempts still took real wall-clock
// time, so the total reflects what actually ran, not just the attempt whose status "won":
function specDuration(spec) {
  let total = 0;
  for (const test of spec.tests || []) {
    for (const result of test.results || []) {
      total += result.duration || 0;
    }
  }
  return total;
}

// counts retry attempts (results beyond the first) and how much wall-clock time they added, so a report reader
// can see when a "passed"/"flaky" result only got there after retrying, and how expensive that was:
function specRetryInfo(spec) {
  let retryCount = 0;
  let retryDurationMs = 0;
  for (const test of spec.tests || []) {
    const results = test.results || [];
    for (let i = 1; i < results.length; i++) {
      retryCount++;
      retryDurationMs += results[i].duration || 0;
    }
  }
  return { retryCount, retryDurationMs };
}

// maps scenario number -> duration (ms) for top-level steps whose own title starts with a "#N" tag (e.g. "#5 -
// Save Import Manifest..." inside a bundled "#5-8 create new Import Manifest..." test), summed across every
// attempt/occurrence - gives each scenario within a bundled test its own real duration instead of repeating the
// whole test()'s total for every number it covers. Falls back to that total (via specDuration()) in buildRows()
// for numbers with no matching step (e.g. a test with no test.step() calls at all):
function specStepDurationsByNumber(spec) {
  const byNumber = {};
  for (const test of spec.tests || []) {
    for (const result of test.results || []) {
      for (const step of result.steps || []) {
        const { refs } = parseTags(step.title);
        for (const ref of refs) {
          byNumber[ref.number] = (byNumber[ref.number] || 0) + (step.duration || 0);
        }
      }
    }
  }
  return byNumber;
}

function formatDuration(ms) {
  if (!ms) return null;
  if (ms < 1000) return `${ms}ms`;
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
}

// concatenates every attempt's captured stdout for a spec - a retried test can log its values more than once,
// and a multi-step test logs them across several test.step() calls within the same attempt:
function specStdout(spec) {
  const chunks = [];
  for (const test of spec.tests || []) {
    for (const result of test.results || []) {
      for (const item of result.stdout || []) {
        chunks.push(typeof item === 'string' ? item : item.text ?? '');
      }
    }
  }
  return chunks.join('\n');
}

// keeps the LAST match for a given label - a multi-step test can log a draft value early and the real one
// after it actually submits (e.g. createNewImportECL's tests log a draft "Reference Number" then a later
// "Submitted Reference Number" once the submit itself goes through):
function lastMatch(text, label) {
  const re = new RegExp(`${label}:\\s*(\\S+)`, 'g');
  let match = null;
  let m;
  while ((m = re.exec(text))) match = m;
  return match ? match[1].trim() : null;
}

// the tests console.log several labels for the same kind of value ("Reference Number", "Submitted Reference
// Number", "Import Manifest Reference Number", "ECL Number") - "Submitted Reference Number" wins when present
// since it reflects the final submitted state rather than a draft; "Reference Number" also matches inside the
// longer "Submitted "/"Import Manifest " prefixed labels, which is harmless since those are only consulted when
// the more specific label found nothing. "ECL Number" is the fallback for ECL-only tests that never log a bare
// manifest reference at all:
function extractLogValues(spec) {
  const text = specStdout(spec);
  return {
    referenceNumber: lastMatch(text, 'Submitted Reference Number') || lastMatch(text, 'Reference Number') || lastMatch(text, 'ECL Number'),
    messageId: lastMatch(text, 'Submitted Message Id'),
  };
}

// screenshot/video attachments (only present when a test failed - see playwright.config.ts's
// screenshot: 'only-on-failure' / video: 'retain-on-failure'), converted to file:// links so the report can be
// opened locally and jump straight to the artifact on disk. Kept as the LAST occurrence of each kind across every
// attempt, same "final state wins" reasoning as extractLogValues():
function specAttachments(spec) {
  const byName = {};
  for (const test of spec.tests || []) {
    for (const result of test.results || []) {
      for (const att of result.attachments || []) {
        if (att.path && (att.name === 'screenshot' || att.name === 'video')) {
          byName[att.name] = att.path;
        }
      }
    }
  }
  return Object.entries(byName).map(([name, filePath]) => ({ name, sourcePath: filePath }));
}

function walkSuites(suites, file, out) {
  for (const suite of suites) {
    const suiteFile = suite.file || file;
    for (const spec of suite.specs || []) {
      out.push({
        title: spec.title,
        file: (spec.file || suiteFile).replace(/\\/g, '/'),
        status: specStatus(spec),
        duration: specDuration(spec),
        stepDurations: specStepDurationsByNumber(spec),
        attachments: specAttachments(spec),
        ...specRetryInfo(spec),
        ...extractLogValues(spec),
      });
    }
    if (suite.suites) walkSuites(suite.suites, suiteFile, out);
  }
}

function loadSpecs(resultFiles) {
  const specs = [];
  for (const f of resultFiles) {
    const data = JSON.parse(fs.readFileSync(f, 'utf-8'));
    walkSuites(data.suites || [], null, specs);
  }
  return specs;
}

function buildRows(specs, scenarios) {
  // sheet -> number -> row
  const bySheetNumber = {};
  for (const sheet of Object.keys(scenarios)) {
    bySheetNumber[sheet] = {};
    for (const s of scenarios[sheet]) {
      bySheetNumber[sheet][s.number] = {
        sheet,
        number: s.number,
        description: s.scenario,
        status: 'not automated',
        testTitle: null,
        file: null,
        referenceNumber: null,
        messageId: null,
        duration: null,
        attachments: [],
        retryCount: 0,
        retryDurationMs: 0,
      };
    }
  }

  const untaggedSpecs = [];

  for (const spec of specs) {
    const { refs, rest } = parseTags(spec.title);
    if (refs.length === 0) {
      untaggedSpecs.push(spec);
      continue;
    }
    for (const ref of refs) {
      const sheet = ref.prefix ? PREFIX_SHEET_MAP[ref.prefix] : sheetForFile(spec.file);
      if (!sheet || !bySheetNumber[sheet] || !bySheetNumber[sheet][ref.number]) continue;
      const row = bySheetNumber[sheet][ref.number];
      row.status = spec.status;
      row.testTitle = rest;
      row.file = spec.file;
      row.referenceNumber = spec.referenceNumber;
      row.messageId = spec.messageId;
      row.attachments = spec.attachments;
      row.retryCount = spec.retryCount;
      row.retryDurationMs = spec.retryDurationMs;
      //prefer this scenario's own step duration (e.g. "#5"'s specific test.step()) over the whole test()'s
      //total, so a bundled test's numbers each show their own real time instead of all repeating the same sum:
      row.duration = spec.stepDurations[ref.number] ?? spec.duration;
    }
  }

  const rows = [];
  for (const sheet of Object.keys(scenarios)) {
    for (const s of scenarios[sheet]) {
      rows.push(bySheetNumber[sheet][s.number]);
    }
  }
  return { rows, untaggedSpecs };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function statusBadge(status) {
  const classes = {
    passed: 'badge-pass',
    failed: 'badge-fail',
    flaky: 'badge-flaky',
    skipped: 'badge-skip',
    'not automated': 'badge-none',
  };
  const labels = {
    passed: 'Passed',
    failed: 'Failed',
    flaky: 'Flaky',
    skipped: 'Skipped',
    'not automated': 'Not automated',
  };
  return `<span class="badge ${classes[status] || 'badge-none'}">${labels[status] || status}</span>`;
}

const ATTACHMENT_LABELS = { screenshot: 'Screenshot', video: 'Video' };

function mediaLinks(attachments) {
  const usable = (attachments || []).filter((a) => a.url);
  if (!usable.length) return '<span class="muted">-</span>';
  return usable
    .map((a) => `<a href="${escapeHtml(a.url)}" target="_blank">${ATTACHMENT_LABELS[a.name] || a.name}</a>`)
    .join(' · ');
}

// small "(↻1, +36.1s)"-style note appended after a duration cell when the result needed at least one retry -
// makes it visible at a glance which "passed"/"flaky" rows only got there on a second (or later) attempt, and how
// much of the total duration that retrying itself cost:
function retryNote(retryCount, retryDurationMs) {
  if (!retryCount) return '';
  const plural = retryCount === 1 ? 'retry' : 'retries';
  return ` <span class="retry-note">(↻${retryCount} ${plural}, +${escapeHtml(formatDuration(retryDurationMs))})</span>`;
}

function renderHtml(rows, untaggedSpecs, resultFiles, totalDurationMs) {
  const bySheet = {};
  for (const row of rows) {
    (bySheet[row.sheet] ||= []).push(row);
  }

  const totals = { passed: 0, failed: 0, flaky: 0, skipped: 0, 'not automated': 0 };
  for (const row of rows) totals[row.status] = (totals[row.status] || 0) + 1;

  const sheetsHtml = Object.entries(bySheet)
    .map(([sheet, sheetRows]) => {
      const body = sheetRows
        .map(
          (r) => `
        <tr class="row-${(r.status || '').replace(/\s+/g, '-')}">
          <td class="num">#${r.number}</td>
          <td>${escapeHtml(r.description)}</td>
          <td class="ref">${r.referenceNumber ? escapeHtml(r.referenceNumber) : '<span class="muted">-</span>'}</td>
          <td class="ref">${r.messageId ? escapeHtml(r.messageId) : '<span class="muted">-</span>'}</td>
          <td class="duration">${r.duration ? escapeHtml(formatDuration(r.duration)) + retryNote(r.retryCount, r.retryDurationMs) : '<span class="muted">-</span>'}</td>
          <td>${statusBadge(r.status)}</td>
          <td class="media">${mediaLinks(r.attachments)}</td>
        </tr>`
        )
        .join('');
      return `
      <h2>${escapeHtml(sheet)}</h2>
      <table>
        <thead><tr><th>#</th><th>Scenario</th><th>Reference #</th><th>Message ID</th><th>Duration</th><th>Status</th><th>Media</th></tr></thead>
        <tbody>${body}</tbody>
      </table>`;
    })
    .join('\n');

  const untaggedHtml = untaggedSpecs.length
    ? `
      <h2>Tests without a scenario reference</h2>
      <table>
        <thead><tr><th>Test</th><th>Reference #</th><th>Message ID</th><th>Duration</th><th>Status</th><th>Media</th></tr></thead>
        <tbody>
          ${untaggedSpecs
            .map(
              (s) => `<tr class="row-${(s.status || '').replace(/\s+/g, '-')}"><td class="test-title">${escapeHtml(s.title)}</td><td class="ref">${s.referenceNumber ? escapeHtml(s.referenceNumber) : '<span class="muted">-</span>'}</td><td class="ref">${s.messageId ? escapeHtml(s.messageId) : '<span class="muted">-</span>'}</td><td class="duration">${s.duration ? escapeHtml(formatDuration(s.duration)) + retryNote(s.retryCount, s.retryDurationMs) : '<span class="muted">-</span>'}</td><td>${statusBadge(s.status)}</td><td class="media">${mediaLinks(s.attachments)}</td></tr>`
            )
            .join('')}
        </tbody>
      </table>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Fasah Test Case Report</title>
<style>
  body { font-family: -apple-system, Segoe UI, Arial, sans-serif; margin: 0; padding: 24px; background: #f7f7f8; color: #1a1a1a; }
  h1 { margin: 0 0 4px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
  .summary { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
  .stat { background: #fff; border: 1px solid #e2e2e2; border-radius: 8px; padding: 10px 16px; min-width: 110px; }
  .stat .n { font-size: 22px; font-weight: 700; }
  .stat .l { font-size: 12px; color: #666; }
  h2 { margin-top: 32px; border-bottom: 2px solid #e2e2e2; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,.05); }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 13px; vertical-align: top; }
  th { background: #fafafa; font-weight: 600; color: #444; }
  td.num { font-weight: 700; white-space: nowrap; }
  td.test-title { color: #333; }
  td.ref { color: #333; white-space: nowrap; font-size: 12px; }
  td.duration { color: #666; white-space: nowrap; font-size: 12px; }
  td.media { white-space: nowrap; font-size: 12px; }
  td.media a { color: #1a5fb4; text-decoration: none; }
  td.media a:hover { text-decoration: underline; }
  .retry-note { color: #a5690a; font-size: 11px; white-space: nowrap; }
  .muted { color: #bbb; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 600; white-space: nowrap; }
  .badge-pass { background: #e3f9e5; color: #1e7d2b; }
  .badge-fail { background: #fde8e8; color: #c81e1e; }
  .badge-flaky { background: #fff4e0; color: #a5690a; }
  .badge-skip { background: #eef0f2; color: #666; }
  .badge-none { background: #f3f3f3; color: #999; }
  tr.row-failed { background: #fffafa; }
</style>
</head>
<body>
  <h1>Fasah Test Case Report</h1>
  <div class="meta">Generated ${new Date().toISOString()} from: ${resultFiles.map(escapeHtml).join(', ')}</div>
  <div class="summary">
    <div class="stat"><div class="n">${escapeHtml(formatDuration(totalDurationMs || 0))}</div><div class="l">Total duration</div></div>
    <div class="stat"><div class="n">${totals.passed || 0}</div><div class="l">Passed</div></div>
    <div class="stat"><div class="n">${totals.failed || 0}</div><div class="l">Failed</div></div>
    <div class="stat"><div class="n">${totals.flaky || 0}</div><div class="l">Flaky</div></div>
    <div class="stat"><div class="n">${totals.skipped || 0}</div><div class="l">Skipped</div></div>
    <div class="stat"><div class="n">${totals['not automated'] || 0}</div><div class="l">Not automated</div></div>
  </div>
  ${sheetsHtml}
  ${untaggedHtml}
</body>
</html>`;
}

// Playwright clears/overwrites its outputDir (test-results/) on every new run, so a report's screenshot/video
// links pointing straight at those original paths go dead (ERR_FILE_NOT_FOUND) the moment a later run happens -
// confirmed live, 2026-09-27. Copies each attachment next to the report itself, into "<report-name>_files/", and
// points each row's attachment url at that permanent copy instead, so old reports keep working:
function persistAttachments(rows, untaggedSpecs, outputPath) {
  const assetsDirName = path.basename(outputPath).replace(/\.html?$/i, '') + '_files';
  const assetsDir = path.join(path.dirname(outputPath), assetsDirName);
  let counter = 0;

  const persistOne = (att) => {
    if (!att.sourcePath || !fs.existsSync(att.sourcePath)) {
      att.url = null;
      return;
    }
    counter++;
    const destName = `${counter}-${att.name}${path.extname(att.sourcePath)}`;
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.copyFileSync(att.sourcePath, path.join(assetsDir, destName));
    att.url = `${assetsDirName}/${destName}`;
  };

  for (const row of rows) {
    for (const att of row.attachments || []) persistOne(att);
  }
  for (const spec of untaggedSpecs) {
    for (const att of spec.attachments || []) persistOne(att);
  }
}

function main() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf('-o');
  const outputPath = outIndex >= 0 ? args[outIndex + 1] : 'reports/test-case-report.html';
  const automatedOnly = args.includes('--automated-only');
  const renumber = args.includes('--renumber');
  const sheetIndex = args.indexOf('--sheet');
  const sheetFilter = sheetIndex >= 0 ? args[sheetIndex + 1] : null;
  const excludeIndex = args.indexOf('--exclude-numbers');
  const excludeNumbers = excludeIndex >= 0 ? args[excludeIndex + 1].split(',').map(Number) : [];
  const resultFiles = args.filter(
    (a, i) =>
      a !== '-o' &&
      args[i - 1] !== '-o' &&
      a !== '--automated-only' &&
      a !== '--renumber' &&
      a !== '--sheet' &&
      args[i - 1] !== '--sheet' &&
      a !== '--exclude-numbers' &&
      args[i - 1] !== '--exclude-numbers'
  );

  if (resultFiles.length === 0) {
    console.error(
      'Usage: node scripts/generate-test-case-report.js <results.json...> -o <output.html> [--automated-only]'
    );
    process.exit(1);
  }

  const scenarios = JSON.parse(fs.readFileSync(SCENARIOS_PATH, 'utf-8'));
  const specs = loadSpecs(resultFiles);
  let { rows, untaggedSpecs } = buildRows(specs, scenarios);
  //--automated-only: drop the placeholder rows for scenarios nobody has written a test for yet, showing just
  //the ones we actually have coverage for:
  if (automatedOnly) {
    rows = rows.filter((r) => r.status !== 'not automated');
  }
  //--sheet <name>: only show one spreadsheet sheet (e.g. "Air Transit Manifest") instead of every sheet in
  //test-scenarios.json - useful when the results file only covers one area and the other sheets' "not automated"
  //placeholders would otherwise just be noise:
  if (sheetFilter) {
    rows = rows.filter((r) => r.sheet === sheetFilter);
    untaggedSpecs = [];
  }
  //--exclude-numbers 15,16,17,18: drop specific scenario-number rows entirely, e.g. to hide a known-flaky bundled
  //test the user doesn't want cluttering this particular report:
  if (excludeNumbers.length) {
    rows = rows.filter((r) => !excludeNumbers.includes(r.number));
  }
  //--renumber: the original spreadsheet numbers can have gaps once rows without a matching test run are dropped
  //(--automated-only) or excluded (--exclude-numbers) - e.g. #22 then #25, skipping #23/#24 entirely. Reassign a
  //clean, continuous 1..N sequence over whatever rows actually remain, so the report reads as one unbroken list
  //instead of jumping around the original numbering:
  if (renumber) {
    rows = rows.map((r, i) => ({ ...r, number: i + 1 }));
  }
  //each unique test's own total (not the per-scenario-row durations, which are step-level slices of these same
  //totals and would double-count once a bundled test's time is spread across several scenario numbers):
  const totalDurationMs = specs.reduce((sum, s) => sum + (s.duration || 0), 0);
  persistAttachments(rows, untaggedSpecs, outputPath);
  const html = renderHtml(rows, untaggedSpecs, resultFiles, totalDurationMs);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log(`Wrote ${outputPath}`);

  const total = rows.length;
  const covered = rows.filter((r) => r.status !== 'not automated').length;
  console.log(`Scenario coverage: ${covered}/${total}`);
}

main();
