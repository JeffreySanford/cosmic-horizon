# Contract Fixtures

This directory contains versioned JSON samples of Tapis API requests and
responses used by unit tests. Files are organized by version (e.g. `v1/`) so
we can evolve the shapes without breaking tests.

Each test should load the appropriate fixture and assert that the parsing
logic matches the expected schema. Fixtures are sanitized copies from the
real API and do not contain any secrets. Current samples include
`job-submit.json`, `job-status.json`, as well as basic `job-list.json` and
`files-list.json` used for list-operations tests.
