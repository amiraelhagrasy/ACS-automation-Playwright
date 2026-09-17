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
  "tests/Freight Forwarder/billTiedToDeliveryOrderNotSelectable.spec.ts"
  "tests/Freight Forwarder/createHouseAirwayBill.spec.ts"
  "tests/Freight Forwarder/fixedBillNotSelectableInReservation.spec.ts"
)

BUCKET_B=(
  "tests/Import Manifest/linkMasterBillWithExpress.spec.ts"
)

BUCKET_C1=(
  "tests/Export Manifest/createNewExportECL.spec.ts"
  "tests/Export Manifest/newExportMan.spec.ts"
  "tests/Export Manifest/viewExportMan.spec.ts"
  "tests/LoginTest.spec.ts"
)

BUCKET_C2=(
  "tests/Import Manifest/createNewImportECL.spec.ts"
  "tests/Import Manifest/newImportManExpTest.spec.ts"
  "tests/Import Manifest/newImportManTest.spec.ts"
)

BUCKET_C3=(
  "tests/Import Manifest/viewImportManByRefTest.spec.ts"
  "tests/Import Manifest/viewImportManExp.spec.ts"
  "tests/Transit Manifest/createNewTransit.spec.ts"
  "tests/Transit Manifest/createNewTransitECL.spec.ts"
)

run_bucket() {
  local name="$1"; shift
  local files=("$@")
  PLAYWRIGHT_JSON_OUTPUT_NAME="regression-results-${name}.json" \
  PLAYWRIGHT_HTML_REPORT="playwright-report-regression-${name}" \
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
