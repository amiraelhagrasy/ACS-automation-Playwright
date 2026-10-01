import * as fs from 'fs';
import * as path from 'path';

const POOL_PATH = path.join(__dirname, 'manifestPool.json');

type PoolEntry = {
  type: string;
  referenceNumber: string;
  messageId: string;
  createdAt: string;
};

//best-effort: a write/read failure here should never fail the actual test that's donating or trying to
//reuse a manifest - this pool is purely a speed optimization, not a correctness requirement.

export function addManifestToPool(type: string, referenceNumber: string, messageId: string): void {
  try {
    const entries: PoolEntry[] = fs.existsSync(POOL_PATH)
      ? JSON.parse(fs.readFileSync(POOL_PATH, 'utf-8'))
      : [];
    entries.push({ type, referenceNumber, messageId, createdAt: new Date().toISOString() });
    fs.writeFileSync(POOL_PATH, JSON.stringify(entries, null, 2), 'utf-8');
  } catch {
    //pool write failed - not fatal, the donating test's own result is unaffected
  }
}

//claims (removes) the first unclaimed entry of the given type, or returns null if none exists. Read-filter-
//write, not a true file lock - acceptable here since this repo runs these suites with low worker counts and a
//failed claim just means that one test falls back to building its own manifest instead of a hard failure:
export function claimManifestFromPool(type: string): { referenceNumber: string; messageId: string } | null {
  try {
    if (!fs.existsSync(POOL_PATH)) return null;
    const entries: PoolEntry[] = JSON.parse(fs.readFileSync(POOL_PATH, 'utf-8'));
    const index = entries.findIndex((e) => e.type === type);
    if (index === -1) return null;
    const [claimed] = entries.splice(index, 1);
    fs.writeFileSync(POOL_PATH, JSON.stringify(entries, null, 2), 'utf-8');
    return { referenceNumber: claimed.referenceNumber, messageId: claimed.messageId };
  } catch {
    return null;
  }
}
