import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const ROOT = resolve(process.cwd(), 'astronomy-data');

const DATASETS = [
  {
    id: 'VLASS2.1.sb38593457.eb38602345',
    survey: 'VLASS',
    target: 'J1347+1217',
    band: 'S',
  },
  {
    id: 'NVSS.J1347+1217',
    survey: 'NVSS',
    target: 'J1347+1217',
    band: 'L',
  },
  {
    id: 'ALMA.calibrator.J0423-0120',
    survey: 'ALMA',
    target: 'J0423-0120',
    band: 'Band 3',
  },
];

async function ensureDir(path) {
  if (!existsSync(path)) {
    await mkdir(path, { recursive: true });
  }
}

async function ensureDataset(seed) {
  const dir = join(ROOT, seed.id);
  await ensureDir(dir);

  const metadata = {
    id: seed.id,
    survey: seed.survey,
    target: seed.target,
    band: seed.band,
    seededBy: 'scripts/seed-astro-datasets.mjs',
    seededAt: new Date().toISOString(),
    note: 'Demo dataset placeholder for local orchestration flows.',
  };

  await writeFile(
    join(dir, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
  );
  await writeFile(
    join(dir, 'README.txt'),
    `Dataset: ${seed.id}\nSurvey: ${seed.survey}\nTarget: ${seed.target}\nBand: ${seed.band}\n`,
  );
  await writeFile(
    join(dir, 'placeholder.ms.txt'),
    'Placeholder content for demo dataset discovery and job submission paths.\n',
  );
}

async function main() {
  await ensureDir(ROOT);
  for (const dataset of DATASETS) {
    await ensureDataset(dataset);
  }
  console.log(`Seeded ${DATASETS.length} demo datasets in ${ROOT}`);
}

void main();
