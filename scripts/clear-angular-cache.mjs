import { rmSync } from 'fs';
import { join } from 'path';

const cachePath = join(process.cwd(), '.angular', 'cache');
try {
  rmSync(cachePath, { recursive: true, force: true });
  console.log(`Removed Angular cache at: ${cachePath}`);
} catch {
  console.warn(`No Angular cache to remove at: ${cachePath}`);
}
