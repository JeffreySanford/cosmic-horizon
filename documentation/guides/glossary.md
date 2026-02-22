# Glossary

A running glossary for terms used throughout the Remote Compute Gateway
project.

- **ALLOCATIONS (SU)** – Service Units allocated by ACCESS/TACC to a project;
  charged per CPU‑hour or GPU‑hour depending on system.
- **API** – Application Programming Interface; typically refers to the HTTP
  endpoints exposed by the Cosmic Horizons backend (e.g. `/api/jobs`).
- **Demo mode** – operational mode where compute jobs are handled by the local
  simulation (`DemoTaccAdapter`). No real resources are consumed.
- **Live mode** – mode where actual Tapis/Slurm endpoints are invoked via the
  `LiveTaccAdapter` using real credentials.
- **Feature flag** – runtime configuration (e.g. `TACC_LIVE=true`) used to
  toggle between demo/live behaviour.
- **LLM** – large language model; in this project refers to the Ollama
  instance used for the local‑LLM simulation.
- **Provenance** – metadata tracking the origin and transformation of a job,
  used for auditing and explainability.
- **TACC** – Texas Advanced Computing Center.
- **Tapis** – the HTTP API layer provided by TACC for job and data management.
- **UI** – user interface, typically the Angular frontend in `apps/cosmic-horizons-web`.
