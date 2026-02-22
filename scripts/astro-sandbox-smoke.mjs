#!/usr/bin/env node
// Simple smoke script for the astronomy sandbox profile.
// Ensures the CASA and WSClean containers can be pulled and run a version check.

import { execSync } from 'child_process';

function smokeRun(image, cmd = '--version') {
  try {
    console.log(`Pulling image ${image}...`);
    execSync(`docker pull ${image}`, { stdio: 'inherit' });
    console.log(`Running ${image} ${cmd}...`);
    execSync(`docker run --rm ${image} ${cmd}`, { stdio: 'inherit' });
    console.log(`${image} smoke succeeded`);
  } catch (e) {
    console.error(`Smoke test failed for ${image}:`, e.message);
    process.exit(1);
  }
}

smokeRun('casapy/casa:latest', '-c "print(\"CASA OK\")"');
smokeRun('bera/wsclean:latest', '--help');

console.log('Astronomy sandbox smoke tests completed successfully');
