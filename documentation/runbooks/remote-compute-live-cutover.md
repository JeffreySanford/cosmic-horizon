# Runbook: Remote Compute Gateway Live Cutover

This runbook describes the steps required to switch from demo/local mode (including `local-llm`) to
live mode once valid TACC/CosmicAI credentials are available.

1. **Verify credentials**
   - Confirm `TACC_ACCESS_TOKEN`, `TACC_TENANT_BASE_URL`, and other required
     variables are set in the `.env` or environment. Use the demo test script
     to perform a simple `GET /v3/jobs` against Tapis.
2. **Enable live flag**
   - Set `TACC_LIVE=true` (or `REMOTE_COMPUTE_MODE=live`) in configuration.
   - Restart the API service.
3. **Smoke test**
   - Submit a trivial job via UI or curl: `POST /api/jobs/submit` with known good
     parameters. Verify job ID pattern (`tacc-...`).
   - Poll status until completion.
4. **Monitor logs and guard metrics**
   - Ensure correlation IDs appear and are consistent across service boundaries.
   - Check for 4xx/5xx errors from Tapis; if encountered, roll back.
   - Watch for rate limit events or schema validation failures in local-llm mode; consult the docs at `documentation/backend/RATE-LIMITING.md` and the LLM guard page for details.
5. **Audit**
   - Confirm events emitted via Rabbit/Kafka use the job lifecycle schema and
     carry the correlation ID.
6. **Fallback plan**
   - If issues occur, clear `TACC_LIVE` and restart back in demo mode.
   - Open a support ticket with TACC including correlation IDs and error
     messages.
7. **Secrets hygiene**
   - Ensure CI secret scanning is active before pushing live-mode secrets.
   - See `documentation/reference/ENV-REFERENCE.md` for environment variable
     guidance.

Keep this document updated as cutover automation or credential processes evolve.
