import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(__dirname, 'lastExpressReferenceNumber.json');

export function saveExpressReferenceNumber(referenceNumber: string): void {
  fs.writeFileSync(filePath, JSON.stringify({ referenceNumber }), 'utf-8');
}

export function loadExpressReferenceNumber(): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content).referenceNumber;
}
