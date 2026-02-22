# Dataset Acquisition Strategy

Our objective is to make the jobs console choose and download real
measurement sets (MS) automatically, turning a generic job definition into a
miniature astrophysical pipeline.  Because the demos only need a few hundred
megabytes, we limit ourselves to a small curated set of publicly‑accessible
files.

## Candidate sources

* **NRAO Science Data Archive** – the canonical repository for VLA/VLBA/ALMA
  data.  Use the WebUI search to find a convenient project (e.g. VLASS or an
  ALMA calibration field) and copy the provided `wget` script.  These MS files
  can be fed to any of our astronomy containers (CASA, WSClean, DDFacet,
  LOFAR pipelines, etc.).
* **VLASS quicklook** – survey pointings are available as `*ms` files; each is
  ~1–3 GB, perfect for a laptop demo with CASA or WSClean on the local i9
  machine.  Running multiple pointings sequentially exercises both CPU and GPU
  resources.
* **NVSS survey** – older continuum data useful for very fast local runs and
  for evaluating SPAM/OBIT workflows.
* **ALMA public** – smaller, high‑frequency sets good for showing spectral line
  imaging or feeding into CASA’s `tclean` script; the file sizes are modest
  enough that even first‑generation dev PCs can handle them.

### Additional considerations

* **Checksum/ETag validation** – compute a hash or store the HTTP ETag so tests
  can quickly detect corrupt or partial downloads.  The fetch script can
  re‑download if the existing file fails validation.
* **Synthetic micro‑dataset** – for CI we might generate a tiny fake MS (e.g.
  a few kilobytes) and commit it to the repo or host it as a Git LFS artifact
  so the pipeline never depends on external networks.
* **Policy check** – remind developers that archive data is public but licensed;
  include a note about attribution and avoid embedding proprietary/PI data.
* **Rotation/expiration** – if the manifest grows past a threshold, evict old
  entries or provide a periodic cleanup cron job to reclaim disk space.
* **Remote storage option** – support mounting an S3/GCS bucket or a network
  share so machines with limited local disk can still participate without
  downloading tens of gigabytes.

The helper script below automates the download of one example (replace the
URL with whichever dataset you prefer).  It does not rely on external tools
like `curl` or `wget` – it uses Node's `https` module and exposes a simple
promise API that can be call from tests or from the server-side endpoint.

```js
#!/usr/bin/env node
import { existsSync, statSync } from 'fs';
import { mkdirSync, createWriteStream } from 'fs';
import https from 'https';
import path from 'path';

const destDir = path.resolve('astronomy-data');
const destFile = path.join(destDir, 'sample.ms');
const url = 'https://archive.nrao.edu/archivoftheday/2018/20180816/NRAO_2cm_aoep_0425.ms';

function download(url, out) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(out);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

if (!existsSync(destFile)) {
  console.log('fetching sample measurement set...');
  await download(url, destFile);
  console.log('download complete');
}
```

On the backend we can wrap this script in an API endpoint (`GET /datasets/refresh`)
that checks available disk space and refuses to download if the free space is
below some threshold.  The same endpoint should record a timestamp and
return a `lastUpdated` field so the UI can show when the local copy was
retrieved; if the dataset is older than some configurable age (e.g. 30 days),
clients can warn the user that the data may be stale.

Likewise, add a companion endpoint (`DELETE /datasets/purge`) that deletes
all files under `astronomy-data/` and resets the manifest.  The frontend can
expose this via a "Purge datasets" button or an automatic cleanup routine to
keep disk usage in check.

See *Frontend Enhancements* below for how the UI can query these endpoints
and display both free‑space and last‑updated information.

Call the script at the start of any test that exercises the CASA adapter; it
ensures the dataset is cached locally and avoids manual intervention.

## Dynamically choosing a sky identifier

Instead of hard‑coding the dataset, the frontend may ask the user to select an
`object id` or `sky coordinate`.  A small JSON manifest file in the data
directory can map those identifiers to MS filenames and optional descriptive
metadata.  Example manifest entry:

```json
{
  "J1347+1217": {
    "file": "VLASS_J1347+1217.ms",
    "ra": "13:47:12.3",
    "dec": "+12:17:03",
    "band": "S"
  }
}
```

The API adapter can read this manifest and attach the chosen metadata to the
LLM prompt, or even choose the “closest” dataset automatically if the user
enters coordinates instead of an explicit identifier.

## Testability

Because downloading multi‑GB files in every CI run is impractical, CI should
use a single small dataset (50–200 MB) or a cached copy stored as a Git LFS
artifact.  The `fetch-demo-data` script can detect when it’s running under CI
(via `process.env.CI`) and skip the download if the file already exists in the
workspace.

Summary: you can treat the sample data either as a local directory that
developers update manually, or as a downloadable artefact produced by a
script.  Either way, nothing about the existing jobs UI needs to change; the
existing offline/LLM simulator can continue to operate side‑by‑side and can
be selected via `REMOTE_COMPUTE_MODE`.  The real‑data mechanism is simply
a new optional source of information.
