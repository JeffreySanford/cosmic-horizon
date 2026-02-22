# Why Pulling Real Astronomy Data into the Demo Stack is Risky

The previous documents outline the compelling possibilities of wiring real
measurement sets and CASA/WSClean processing into the existing jobs feature.
Before embarking down that path, it's important to appreciate the practical
costs and downsides.  This note enumerates the main reasons why this idea
can quickly become more trouble than it's worth for a primarily web‑developer
team working on a prototype gateway.

## 1. Large volumes, large dependencies

* The astronomy software suite is massive (`casa` images are >10 GB, WSClean
  and DDFacet each add another gigabyte, SPAM/OBIT and LOFAR pipelines may
  require dozens of system libraries).  Installing any one of these on a
  developer workstation (the team currently has i9 machines with 24 v‑cores,
  64 GB RAM and a 10 GB Nvidia GPU) is feasible but not trivial; running them
  all together means rebuilding enormous containers and dealing with
  conflicting Python versions, library paths, and GPU drivers.
* Public measurement sets are similarly large; even a “toy” VLASS pointing
  consumes 1–3 GB, and a full LOFAR field can be tens of GB.  Storing multiple
  samples for the purpose of letting the user switch between them quickly
  multiplies the storage requirement.  Including them in Git LFS or forcing
  every developer/CI runner to fetch them is expensive and fragile.
* The more packages you try to support (CASA, WSClean, DDFacet, SPAM/OBIT,
  LOFAR), the more compound the dependency footprint becomes.  Each tool has
  its own installation quirks, versioning, and runtime requirements; keeping
  all of them working inside a single compose profile is a maintenance burden
  that grows linearly with the number of tools.

## 2. Performance and resource constraints

* Even with a beefy host (i9, 24 v‑cores, 64 GB RAM, 10 GB GPU) CASA or
  WSClean jobs are slow.  A minimal imaging task on a few‑GB MS can take
  10–30 minutes; LOFAR pipelines routinely require hours.  Running multiple
  packages sequentially (for example calibrate with CASA then image with
  WSClean) multiplies that latency and ties up the machine, blocking other
  developers.
* Launching GPU‑accelerated tools requires driver compatibility inside the
  container; mis‑matched versions are a common source of failures and lead to
  cryptic CUDA errors that frontend developers will have no idea how to fix.
* When you add additional packages – CASA, WSClean, DDFacet, SPAM/OBIT,
  LOFAR pipelines – the aggregate resource footprint exceeds what a typical
  developer workstation is comfortable running, even a beefy i9 box with a
  10 GB GPU.  The resulting environment quickly resembles a mini‑HPC cluster
  rather than a lightweight demo, which contradicts the original goal of easy
  offline web development.
* Even if your hardware can handle it, each new tool adds its own quirks and
  failure modes.  A CI failure caused by a mis‑compiled LOFAR container is a
  distraction from the gateway work and may never reproduce on another
  developer’s machine.
* CI jobs that include such processing either eat huge minutes on the build
  farm or must be disabled entirely, defeating the purpose of having tests in
  the first place.

## 3. Complexity vs payoff

* The gateway and front‑end code were designed to be backend‑agnostic; adding
  astronomy containers and dataset repos increases architectural complexity
  with little added value for most stakeholder stories (which remain about
  job submission, rate limiting, and offline/LLM simulation).
* We already have a perfectly good offline simulator that exercises all
  front‑end behaviours deterministically; the real‑data path duplicates that
  effort while introducing fragile external dependencies (CASA versions,
  container bugs).  In other words, the marginal benefit of real data is
  low compared to the maintenance burden.

## 4. Testing and reproducibility

* Including large, evolving data files in tests makes them non‑deterministic
  and slows down CI.  Every time a dataset is updated or replaced the tests
  must be re‑baselined.
* Network‑dependent download scripts can fail sporadically, turning the CI
  pipeline red for unrelated reasons.

## 5. Domain expertise drift

* The team is primarily focused on web/UIs and the LLM simulation.  Adding a
  requirement to understand radio‑astronomy software, CASA scripting, and
  measurement set metadata pulls developers into a very different domain which
  is outside their core competencies and will likely slow overall progress.

## 6. User expectations

* If the jobs page starts showing real images or processing results, users
  may assume the system has operational access to TACC/NGVLA.  That raises the
  bar for security, credentials, and maintenance, and could create liability
  or support issues.  A purely simulated demo keeps expectations correctly
  low.

---

If the goal is simply to make the UI look convincing, the existing LLM‑based
simulation and a handful of hard‑coded metadata values are usually enough.
Real data can be revisited later as a separate research prototype or when the
team actually has credentials and compute resources to do meaningful analysis.
For now, keeping the demo lightweight and reliable is a safer strategy.
