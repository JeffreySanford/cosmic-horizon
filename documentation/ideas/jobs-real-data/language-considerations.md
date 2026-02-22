# Language & Implementation Options for Astronomy Microservice

Status date: 2026-02-22

The microservice currently implemented in Python (FastAPI + astropy) was
chosen because the scientific tooling we intend to drive (CASA, astropy,
other radio‑astronomy libraries) are Python‑centric.  Before locking in the
stack we briefly evaluated alternatives:

| Language | Pros | Cons |
|----------|------|------|
| **Python** | Native access to astropy and CASA; fast development cycle; lots of examples and community code in astronomy; compatible with the existing worker script; easy to containerise with `pip` requirements. | Python is interpreted (may be slower than compiled languages but this is unlikely to matter for a job‑runner); risk of "script spaghetti" if coding standards are not enforced. |
| **Go** | Single static binary, easy to deploy; good concurrency model; strong typing makes large codebases manageable. | No native astropy – would need to call Python via `exec` or embed an interpreter, or reimplement FITS parsing; fewer libraries for CASA interaction, probably more work overall. |
| **Rust** | High performance and memory safety; existing FITS crates such as `fitsio` provide some functionality. | Steep learning curve and slower development speed; still need to spawn a CASA process or link Python, so interop issues remain. |
| **Java/.NET** | Plenty of web frameworks and strong tooling available. | Introduces a JVM/.NET runtime layer (heavyweight for a simple service); no native astronomy libraries in these ecosystems. |

## Recommendation

Given that our computation fundamentally revolves around **CASA (Python)**
and we want to leverage **astropy** for FITS handling and metadata,
Python is the clear path of least resistance.  The microservice is I/O bound
and the occasional native extension (astronomical libraries) will already
be compiled C/C++, so Python overhead is negligible.  A Go/Rust rewrite
would incur significant extra work without providing commensurate benefit.

If a future requirement emerges whereby the service must run in an
environment that forbids Python (e.g. certain HPC nodes), we can
revisit this decision and either wrap the Python logic behind a GRPC
interface or replace it entirely.  For now, continuing with Python is
pragmatic.

## Python best practices & coding standards

To prevent the microservice from devolving into quick‑and‑dirty script
spaghetti, adopt the following guidelines:

1. **Virtual environment & dependencies**
   - Use a `requirements.txt` file (already created) and pin versions.
   - Consider using `pip-compile` (pip-tools) or Poetry if the dependency
     tree becomes complex.
   - Track `.env` variables separately and document them (done above).

2. **Linting & formatting**
   - Add `flake8`/`pylint` and `black` to the requirements and create a
     pre‑commit configuration.  Enforce `black` formatting and run linters
     in CI (`pnpm run lint:python` or similar).
   - Example `.pre-commit-config.yaml`:

     ```yaml
     repos:
       - repo: https://github.com/psf/black
         rev: 23.3.0
         hooks:
           - id: black
       - repo: https://gitlab.com/pycqa/flake8
         rev: 5.0.4
         hooks:
           - id: flake8
     ```

3. **Project structure**
   - Keep the FastAPI app separate from auxiliary scripts.  Use a simple
     package layout (`astro_service/` with `__init__.py`, `main.py`,
     `jobs.py`, etc.) so tests can import modules directly.
   - Avoid putting business logic in `main.py`; treat that as the entry
     point only.

4. **Type hints & mypy**
   - Enable optional static typing and run `mypy` on the service.  This
     catches many errors early and documents APIs.

5. **Tests**
   - Add pytest tests in `astro_service/tests/` covering the HTTP endpoints,
     worker loop, and error cases.
   - During development run `pytest` in a virtual env or via a script.

6. **CI integration**
   - Add a CI step (`python-lint`/`python-test`) that sets up a venv,
     installs `-r requirements.txt`, runs `black --check`, `flake8`, and
     `pytest --cov`.

7. **Logging**
   - Use the built‑in `logging` module with structured JSON output if
     possible.  Avoid `print` statements except in short scripts.
   - Respect `LOG_LEVEL` environment variable for verbosity.

8. **Error handling**
   - Do not swallow exceptions; return clear HTTP error codes and messages.
   - Use Pydantic models for request/response validation.

9. **Strong typing & asynchronous patterns**
   - Annotate every function, variable, and class with explicit types; enable
     `mypy` and treat its output as part of the CI gate.
   - Prefer `async def` and `await` for I/O; use `typing.AsyncIterator` or
     `typing.AsyncGenerator` for streaming results.  When job state updates are
     pushed, consider wrapping them in an `asyncio.Queue` or using `rx`/`rxpy`
     for an observable-like interface that can be consumed via `async for` loops
     or converted to a Python `asyncio.Stream`.
   - Avoid mixing `await`-able coroutines and plain threads; keep concurrency
     boundaries explicit.
   - Document public API types in docstrings and use `--strict` mypy settings
     where feasible (e.g. `disallow_untyped_defs`).

By following these practices, the microservice can grow beyond a proof‑of‑concept
without becoming unmaintainable.

---

With the above in place, Python remains the fastest, safest route; other
languages would complicate dependency management and would still require
Python bindings for the astronomy libraries, negating most of their
advantages.
