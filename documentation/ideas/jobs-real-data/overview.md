# Real‑Data Jobs Demo Overview

This document collects the ideas discussed during the recent offline/local‑LLM
sprint and serves as a living plan for integrating *real astronomical
measurement sets* into the existing jobs workflow.  The content will be
re‑analysed and updated as the proposal evolves.  The goal is to keep the
current Nest/Angular stack while allowing one or more containers (CASA,
WSClean, etc.) to process publicly‑accessible data and feed results back into
the same API that the demo and LLM already drive.

The existing `jobs` feature is the only user‑visible UI affected; the
backend adapter abstraction makes it trivial to swap between simulator,
local‑LLM, and real‑software implementations.  Work can be performed entirely
inside the current repository – no external environment is required beyond
docker and a handful of sample files.  **Note:** in practice the demo path
is best supported on a Linux host with sufficient disk (≥10 GB) and, if
GPU acceleration is desired, matching Nvidia drivers; Windows/WSL2 may work
but is not officially tested.  We call this a *reference architecture
prototype*, not a production system.

> Note: the motivation for this effort is to address five architectural
> weaknesses of the original synchronous `docker exec` adapter:
> queueing, persistent state, compute isolation, scheduling, and failure
> handling.  The new design resolves these and positions the API as a true
> compute gateway.

## Key components

* **Sample datasets** – small (hundreds of MB to a few GB) measurement sets
  taken from publicly‑archived surveys (VLASS, NVSS, ALMA, etc.).  These are
  stored under `astronomy-data/` or dynamically fetched before tests run.
* **CASA/WSClean (and potentially DDFacet / SPAM/OBIT / LOFAR) containers**
  – added to `docker-compose.yml` under a new `astronomy` profile.  A modern
  development machine (e.g. i9 with 24 virtual cores, 64 GB RAM, 10 GB
  Nvidia GPU) can host several of these images concurrently; the API adapter
  will simply `docker exec` into the appropriate service to run a job script.
  Initially this was synchronous, but later phases convert the adapter to
  enqueue requests on a Redis/RabbitMQ/Kafka queue and hand them off to
  a pool of worker containers.  This “gateway” pattern ensures the API stays
  responsive even under load and gives us room to add persistence, retry
  logic, and error handling.
* **`CasaAdapter`** – a new concrete implementation of the jobs interface
  in `apps/cosmic-horizons-api` that launches the CASA container, runs a
  minimal imaging script, and returns status updates consistent with the
  existing contract.
* **LLM metadata enrichment** – the local‑LLM adapter is extended to read the
  MS header (via CASA `listobs`) and supply those values in generated
  progress messages, so frontend tips are dataset‑aware.
* **Automated data fetch script** – a Node helper under `scripts/` that
  downloads a canonical sample MS using the NRAO API; called automatically by
  CI and optionally by the developer during local startup.
* **Frontend enhancements** – the jobs console adds options for selecting an
  astronomical object or survey, displays the chosen dataset ID, and updates
  the summary text with real metadata.

The following documents detail each area, walk through phased implementation
steps, and surface considerations such as network cost, download latency, and
manageable test setups.
