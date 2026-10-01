#!/usr/bin/env bash
# Runs the regression suite as concurrent Playwright invocations instead of one big serial run, to cut wall-clock
# time on a multi-hour regression. Buckets group test FILES that share a portal account (or mix accounts within
# their own already-serial flow) so no two files touching the SAME account ever run at the same time - except
# broker-only files, since the portal confirmed to support multiple concurrent b3078 sessions, so those are just
# load-balanced across C1/C2/C3 for parallelism, not isolated by account.
#
#   Bucket A     - files that log in as وسيط الشحن (ffw11) at some point (also touch البروكر/b3078 within their
#                  own serial flow, but never concurrently with another file)
#   Bucket B     - the البريد السريع (blqur002) flow (also touches b3078 within its own serial flow)
#   Buckets C1-3 - files that only ever use البروكر (b3078) - the bulk of the suite, split ~evenly by file count
#                  (not by measured runtime - rebalance these lists if one bucket turns out much heavier)
#
# Each bucket runs with --workers=1 internally (serial within itself, matching the existing
# test.describe.configure({mode:'serial'}) pattern already used in the ffw/express files), and all buckets run
# side by side as separate OS processes so they never share a worker pool or output files.
#
# Usage: ./run-regression-parallel.sh

set -uo pipefail
cd "$(dirname "$0")"

CONFIG=playwright.regression.config.ts

BUCKET_A=(
  "tests/Delivery Order/newDeliveryOrder.spec.ts"
  "tests/Freight Forwarder/billReservationRequest.spec.ts"
  "tests/Freight Forwarder/createHouseAirwayBill.spec.ts"
)

BUCKET_B=(
  "tests/Import Manifest/linkMasterBillWithExpress.spec.ts"
)

BUCKET_C1=(
  "tests/Export Manifest/createNewExportECL.spec.ts"
  "tests/Export Manifest/newExportManifest.spec.ts"
  "tests/Login/LoginTest.spec.ts"
)

BUCKET_C2=(
  "tests/Import Manifest/createNewImportECL.spec.ts"
  "tests/Import Manifest/createImportManifest.spec.ts"
)

BUCKET_C3=(
  "tests/Transit Manifest/createNewTransit.spec.ts"
  "tests/Transit Manifest/createNewTransitECL.spec.ts"
)

run_bucket() {
  local name="$1"; shift
  local files=("$@")
  PLAYWRIGHT_JSON_OUTPUT_NAME="regression-results-${name}.json" \
  PLAYWRIGHT_HTML_REPORT="playwright-report-regression-${name}" \
  PLAYWRIGHT_BLOB_OUTPUT_DIR="blob-report-${name}" \
  npx playwright test --config="$CONFIG" --workers=1 --output="test-results-regression-${name}" "${files[@]}" \
    > "regression-bucket-${name}.log" 2>&1
  echo "Bucket ${name} exited with code $?" >> "regression-bucket-${name}.log"
}

echo "Starting bucket A (ffw + broker, ${#BUCKET_A[@]} files)..."
run_bucket A "${BUCKET_A[@]}" &
PID_A=$!

echo "Starting bucket B (express-mail + broker, ${#BUCKET_B[@]} files)..."
run_bucket B "${BUCKET_B[@]}" &
PID_B=$!

echo "Starting bucket C1 (broker-only, ${#BUCKET_C1[@]} files)..."
run_bucket C1 "${BUCKET_C1[@]}" &
PID_C1=$!

echo "Starting bucket C2 (broker-only, ${#BUCKET_C2[@]} files)..."
run_bucket C2 "${BUCKET_C2[@]}" &
PID_C2=$!

echo "Starting bucket C3 (broker-only, ${#BUCKET_C3[@]} files)..."
run_bucket C3 "${BUCKET_C3[@]}" &
PID_C3=$!

echo "All 5 buckets launched (PIDs: $PID_A $PID_B $PID_C1 $PID_C2 $PID_C3). Tailing logs as they arrive - Ctrl+C stops watching, not the runs."
wait "$PID_A" "$PID_B" "$PID_C1" "$PID_C2" "$PID_C3"

echo "All buckets finished. Per-bucket logs: regression-bucket-{A,B,C1,C2,C3}.log"
echo "Per-bucket JSON: regression-results-{A,B,C1,C2,C3}.json"
echo "Per-bucket HTML reports: playwright-report-regression-{A,B,C1,C2,C3}"

# Merge the 5 buckets' blob reports into a single HTML report, then archive a dated copy into reports/ -
# each bucket writes one *.zip into its own blob-report-<name>/ dir (the blob reporter names the file
# report-<commandHash>.zip, not a fixed "report.zip", so it's globbed rather than hardcoded) and they're
# collected under one temp dir, renamed by bucket, before merge-reports scans it.
echo "Merging bucket reports into one..."
MERGE_INPUT=$(mktemp -d)
for name in A B C1 C2 C3; do
  zip_file=$(ls "blob-report-${name}"/*.zip 2>/dev/null | head -1)
  if [ -n "$zip_file" ]; then
    cp "$zip_file" "$MERGE_INPUT/${name}.zip"
  else
    echo "Warning: no report zip found in blob-report-${name}/ - bucket ${name} may have crashed before producing a report (check regression-bucket-${name}.log)"
  fi
done

PLAYWRIGHT_HTML_REPORT=playwright-report-regression \
  npx playwright merge-reports --config="$CONFIG" --reporter=html "$MERGE_INPUT"
rm -rf "$MERGE_INPUT"

REPORT_DATE=$(date +%F)
mkdir -p reports
cp playwright-report-regression/index.html "reports/fasah-regression-${REPORT_DATE}.html"
echo "Merged report: playwright-report-regression/index.html"
# the archived copy is index.html only - the test list, steps and pass/fail tree all work from it, but
# screenshots/videos/traces for failed tests live in playwright-report-regression/data/ (easily 1GB+ for a
# full run) and are NOT copied into reports/, since that'd bloat the git-tracked reports/ folder badly. To
# inspect a failure's screenshot/video/trace, run `npm run report:regression` right after this script finishes,
# before playwright-report-regression/ gets overwritten by the next run:
echo "Archived copy (pass/fail + steps only, no screenshots/video/trace): reports/fasah-regression-${REPORT_DATE}.html"

# Test-case summary: cross-references each bucket's JSON results against the spreadsheet scenario numbers
# baked into the test titles (scripts/test-scenarios.json), so every documented test case shows up next to
# its latest status - not just the ones that happened to run.
BUCKET_JSON_FILES=()
for name in A B C1 C2 C3; do
  if [ -f "regression-results-${name}.json" ]; then
    BUCKET_JSON_FILES+=("regression-results-${name}.json")
  fi
done
if [ ${#BUCKET_JSON_FILES[@]} -gt 0 ]; then
  node scripts/generate-test-case-report.js "${BUCKET_JSON_FILES[@]}" -o "reports/fasah-test-cases-${REPORT_DATE}.html"
fi
