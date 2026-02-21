-- Cosmic Horizons Database Schema
-- Initialized on container startup

-- ============================================================================
-- SEEDED USERS FOR LOCAL DEVELOPMENT
-- ============================================================================
-- These test users are created on database initialization for development.
-- DO NOT use these credentials in production.
--
-- Seeded Users:
--   Username: testuser
--   Email:    test@cosmic.local
--   Password: Password123!
--   Role:     user
--
--   Username: adminuser (or admin)
--   Email:    admin@cosmic.local (or admin-direct@cosmic.local)
--   Password: AdminPassword123!
--   Role:     admin
--
-- To login via UI:
--   - Go to http://localhost:4200/auth/login
--   - Use email (not username)
--   - Examples: test@cosmic.local or admin@cosmic.local
--
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  github_id BIGINT UNIQUE,
  username VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  avatar_url VARCHAR(512),
  email VARCHAR(255) UNIQUE,
  role VARCHAR(32) NOT NULL DEFAULT 'user',
  password_hash VARCHAR(255),
  bio TEXT,
  github_profile_url VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS role VARCHAR(32) NOT NULL DEFAULT 'user';

-- Posts table (notebooks)
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  title VARCHAR(512) NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  published_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published_at);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);

-- Revisions table (post history)
CREATE TABLE IF NOT EXISTS revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  title VARCHAR(512),
  description TEXT,
  content TEXT NOT NULL,
  change_summary VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_revisions_post_id ON revisions(post_id);
CREATE INDEX IF NOT EXISTS idx_revisions_created ON revisions(created_at);

-- Snapshots table (permalink images)
CREATE TABLE IF NOT EXISTS snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL,
  image_url VARCHAR(512) NOT NULL,
  sky_coords JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_snapshots_post_id ON snapshots(post_id);

-- Viewer state table (permalink state objects)
CREATE TABLE IF NOT EXISTS viewer_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_id VARCHAR(16) UNIQUE NOT NULL,
  encoded_state TEXT NOT NULL,
  state_json JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_viewer_states_short_id ON viewer_states(short_id);

-- Viewer snapshots table (artifact metadata)
CREATE TABLE IF NOT EXISTS viewer_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(64) NOT NULL DEFAULT 'image/png',
  size_bytes INTEGER NOT NULL,
  short_id VARCHAR(16) NULL,
  state_json JSONB NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_viewer_snapshots_short_id ON viewer_snapshots(short_id);

-- Comments table (basic)
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  parent_id UUID NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  hidden_at TIMESTAMP NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);

-- Comment reports table
CREATE TABLE IF NOT EXISTS comment_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reason VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  resolved_by UUID NULL,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_comment_id ON comment_reports(comment_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON comment_reports(status);

-- Audit logs table (90-day retention)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  changes JSONB,
  ip_address INET,
  user_agent VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);

-- VLASS cache table for tile data
CREATE TABLE IF NOT EXISTS cosmic_tile_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ra FLOAT NOT NULL,
  dec FLOAT NOT NULL,
  tile_url VARCHAR(512) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ra, dec)
);

-- Community Discoveries (prototype + persisted)
CREATE TABLE IF NOT EXISTS discoveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(512) NOT NULL,
  body TEXT NULL,
  author VARCHAR(128) DEFAULT 'anonymous',
  tags JSONB NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed sample discoveries for local development (20 records)
INSERT INTO discoveries (id, title, body, author, tags, created_at)
SELECT
  uuid_generate_v4(),
  seed.title,
  seed.body,
  seed.author,
  seed.tags::jsonb,
  NOW() - (seed.hours_ago * INTERVAL '1 hour')
FROM (
  VALUES
    ('ngVLA calibration checkpoint posted', 'Direction-dependent calibration run reached stable residuals across long baselines in the latest test batch.', 'Elena Park', '["calibration","ngvla","radio"]', 2),
    ('FRB follow-up window identified', 'A candidate FRB event window aligns with archived sky tiles and has been queued for reprocessing.', 'R. Iqbal', '["frb","transients","follow-up"]', 4),
    ('Gaia DR3 crossmatch update', 'Crossmatch quality improved after outlier rejection on high proper-motion sources.', 'M. Torres', '["gaia","catalog","astrometry"]', 6),
    ('JWST CEERS counterpart hints', 'Several radio detections now have tentative counterparts in CEERS with low-confidence morphology matches.', 'Anika Shah', '["jwst","ceers","multiwavelength"]', 8),
    ('CMB lensing region shortlist', 'Three high-priority fields were selected for stacked lensing validation.', 'D. Alvarez', '["cmb","lensing","survey"]', 10),
    ('Solar burst contamination note', 'Short-duration solar burst interference was observed in a narrow band and masked during ingest.', 'H. Nguyen', '["solar","rfi","quality"]', 12),
    ('Pulsar timing residual trend', 'Timing residuals remain within expected limits after clock correction rollout.', 'K. Patel', '["pulsar","timing","validation"]', 14),
    ('Molecular cloud segmentation draft', 'Preliminary segmentation captures dense clumps but underestimates filament continuity.', 'S. Becker', '["ism","molecular-cloud","segmentation"]', 16),
    ('HI line cube denoise benchmark', 'The denoise model improved HI feature continuity with minimal flux suppression.', 'L. Kim', '["hi","spectral-cube","ml"]', 18),
    ('Exoplanet host radio check', 'No strong host-star burst signatures were found in this pass; deeper stack planned.', 'A. Mensah', '["exoplanet","stellar-activity","radio"]', 20),
    ('M87 jet morphology comparison', 'Jet feature alignment remains consistent with prior baseline imaging under updated weights.', 'N. Rossi', '["m87","imaging","jet"]', 22),
    ('Gravitational-wave follow-up prep', 'Rapid response field templates were updated for next observing run coordination.', 'I. Farouk', '["gw","alerts","operations"]', 24),
    ('Cosmic ray artifact filter tuning', 'Artifact classifier reduced false positives in edge regions by approximately 18 percent.', 'P. Sullivan', '["cosmic-ray","filtering","quality"]', 26),
    ('Survey completeness check', 'Completeness estimates improved in low-SNR regions after revised source extraction thresholds.', 'Y. Chen', '["survey","completeness","catalog"]', 28),
    ('SETI candidate triage note', 'A narrowband candidate was classified as terrestrial interference after repeatability checks.', 'J. Rivera', '["seti","triage","rfi"]', 30),
    ('Cluster relic emission candidate', 'Diffuse relic-like structure detected near cluster edge; pending independent confirmation.', 'T. Wallace', '["clusters","diffuse-emission","candidate"]', 32),
    ('VLASS tile stitching update', 'Seam correction pass reduced visible discontinuities along mosaic boundaries.', 'G. Okafor', '["vlass","imaging","mosaic"]', 34),
    ('Archive growth projection refresh', 'Storage projection updated using current ingest trendlines and retention assumptions.', 'Platform Ops', '["archive","capacity","planning"]', 36),
    ('Inference drift monitor flagged', 'One anomaly detector shows moderate drift versus baseline validation set.', 'Model Ops', '["inference","drift","monitoring"]', 38),
    ('Symposium 2026 abstract reminder', 'Cosmic Horizons Conference abstract deadline is April 1, 2026. Draft submissions are now open.', 'announcements', '["symposium","deadline","community"]', 40)
) AS seed(title, body, author, tags, hours_ago)
WHERE NOT EXISTS (
  SELECT 1
  FROM discoveries d
  WHERE d.title = seed.title
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users
CREATE TRIGGER users_update_timestamp
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Apply trigger to posts
CREATE TRIGGER posts_update_timestamp
BEFORE UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Apply trigger to comments
CREATE TRIGGER comments_update_timestamp
BEFORE UPDATE ON comments
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Apply trigger to viewer_states
CREATE TRIGGER viewer_states_update_timestamp
BEFORE UPDATE ON viewer_states
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Apply trigger to viewer_snapshots
CREATE TRIGGER viewer_snapshots_update_timestamp
BEFORE UPDATE ON viewer_snapshots
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Seed local credential test user for JWT auth development.
INSERT INTO users (
  github_id,
  username,
  display_name,
  email,
  role,
  password_hash,
  github_profile_url
)
VALUES (
  NULL,
  'testuser',
  'Test User',
  'test@cosmic.local',
  'user',
  crypt('Password123!', gen_salt('bf')),
  NULL
)
ON CONFLICT (username) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  password_hash = EXCLUDED.password_hash,
  deleted_at = NULL;

-- Seed admin credential user for RBAC development (adminuser username variant).
INSERT INTO users (
  github_id,
  username,
  display_name,
  email,
  role,
  password_hash,
  github_profile_url
)
VALUES (
  NULL,
  'adminuser',
  'Admin User',
  'admin@cosmic.local',
  'admin',
  crypt('AdminPassword123!', gen_salt('bf')),
  NULL
)
ON CONFLICT (username) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  password_hash = EXCLUDED.password_hash,
  deleted_at = NULL;

-- Seed admin user with 'admin' username for convenience (alias)
INSERT INTO users (
  github_id,
  username,
  display_name,
  email,
  role,
  password_hash,
  github_profile_url
)
VALUES (
  NULL,
  'admin',
  'Admin User',
  'admin-direct@cosmic.local',
  'admin',
  crypt('AdminPassword123!', gen_salt('bf')),
  NULL
)
ON CONFLICT (username) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  password_hash = EXCLUDED.password_hash,
  deleted_at = NULL;

-- Seed a published notebook post + comments/reports for moderation workflow demos.
INSERT INTO posts (
  id,
  user_id,
  title,
  description,
  content,
  status,
  published_at,
  created_at,
  updated_at
)
SELECT
  uuid_generate_v4(),
  u.id,
  'Seeded Notebook: Moderation Scenarios',
  'Synthetic thread with realistic moderation report cases for local testing.',
  'This seeded post includes comment cases (spam, harassment, misinformation) used to validate moderation UI actions.',
  'published',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days'
FROM users u
WHERE u.username = 'testuser'
  AND NOT EXISTS (
    SELECT 1
    FROM posts p
    WHERE p.title = 'Seeded Notebook: Moderation Scenarios'
  );

INSERT INTO posts (
  id,
  user_id,
  title,
  description,
  content,
  status,
  published_at,
  created_at,
  updated_at
)
SELECT
  uuid_generate_v4(),
  u.id,
  'Seeded Notebook: Array Telemetry Baseline',
  'Baseline throughput and latency observations for broker replay.',
  'Test user seeded post containing summary metrics for telemetry replay windows and baseline drift notes.',
  'published',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days'
FROM users u
WHERE u.username = 'testuser'
  AND NOT EXISTS (
    SELECT 1
    FROM posts p
    WHERE p.title = 'Seeded Notebook: Array Telemetry Baseline'
  );

INSERT INTO posts (
  id,
  user_id,
  title,
  description,
  content,
  status,
  published_at,
  created_at,
  updated_at
)
SELECT
  uuid_generate_v4(),
  u.id,
  'Seeded Notebook: Candidate Transient Review',
  'Draft-style community review thread for anomaly triage.',
  'Test user seeded post with candidate transient notes, review checklist, and verification status placeholders.',
  'draft',
  NULL,
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days'
FROM users u
WHERE u.username = 'testuser'
  AND NOT EXISTS (
    SELECT 1
    FROM posts p
    WHERE p.title = 'Seeded Notebook: Candidate Transient Review'
  );

-- Seed an expanded notebook dataset (20 records total target) for UI table/pagination demos.
INSERT INTO posts (
  id,
  user_id,
  title,
  description,
  content,
  status,
  published_at,
  created_at,
  updated_at
)
SELECT
  uuid_generate_v4(),
  u.id,
  seed.title,
  seed.description,
  seed.content,
  seed.status,
  CASE
    WHEN seed.status = 'published'
      THEN NOW() - (seed.hours_ago * INTERVAL '1 hour')
    ELSE NULL
  END,
  NOW() - (seed.hours_ago * INTERVAL '1 hour'),
  NOW() - (seed.hours_ago * INTERVAL '1 hour')
FROM (
  VALUES
    ('testuser', 'Seeded Notebook: FRB Follow-up Runbook', 'Operational runbook for FRB trigger response.', 'Defines trigger, validation, and reprocessing sequence for fast radio burst follow-up.', 'published', 6),
    ('adminuser', 'Seeded Notebook: Gaia DR3 Crossmatch Quality', 'Crossmatch confidence assessment and outlier policy.', 'Reviews proper-motion-aware outlier rejection improvements in dense stellar fields.', 'published', 8),
    ('admin', 'Seeded Notebook: CEERS Counterpart Candidate List', 'Draft candidate list for cross-survey review.', 'Compiles tentative radio/infrared counterparts for collaborative vetting.', 'draft', 10),
    ('testuser', 'Seeded Notebook: Solar RFI Masking Update', 'Masking strategy revision for transient solar noise.', 'Summarizes channel-preserving masks for short-duration solar interference.', 'published', 12),
    ('adminuser', 'Seeded Notebook: Pulsar Timing Residuals', 'Residual monitoring summary after model refresh.', 'Residual spread remains within expected tolerance bands across key targets.', 'published', 14),
    ('admin', 'Seeded Notebook: Molecular Cloud Segmentation', 'Segmentation quality review for filamentary structure.', 'Evaluates core continuity and bridge preservation in latest segmentation run.', 'published', 16),
    ('testuser', 'Seeded Notebook: HI Cube Denoise Ablation', 'Ablation results across denoise model variants.', 'Model variant C preserved diffuse features with reduced artifact amplification.', 'published', 18),
    ('adminuser', 'Seeded Notebook: Exoplanet Host Variability', 'Draft notes on host-star radio variability.', 'No persistent bursts detected yet; deeper stack scheduled in next cycle.', 'draft', 20),
    ('admin', 'Seeded Notebook: M87 Jet Alignment Check', 'Morphology consistency check against prior baselines.', 'Jet structure remains aligned under revised imaging weights.', 'published', 22),
    ('testuser', 'Seeded Notebook: GW Follow-up Template', 'Rapid response template for gravitational-wave alerts.', 'Provides default observation payload and reviewer checkpoints.', 'published', 24),
    ('adminuser', 'Seeded Notebook: Cosmic Ray Artifact Filter', 'Filter tuning report for edge-region artifacts.', 'False positives decreased while maintaining true-positive retention.', 'published', 26),
    ('admin', 'Seeded Notebook: Survey Completeness Refresh', 'Completeness estimate refresh for low-SNR sectors.', 'Updated completeness tables after extraction threshold adjustments.', 'published', 28),
    ('testuser', 'Seeded Notebook: SETI Candidate Triage', 'Draft triage summary for narrowband candidate.', 'Candidate likely terrestrial but pending final replay and consensus.', 'draft', 30),
    ('adminuser', 'Seeded Notebook: Cluster Relic Candidate', 'Diffuse relic emission candidate log entry.', 'Candidate structure detected near cluster edge with follow-up requested.', 'published', 32),
    ('admin', 'Seeded Notebook: VLASS Stitching Improvements', 'Mosaic seam correction implementation notes.', 'Seam artifacts reduced after overlap blending and gradient correction.', 'published', 34),
    ('testuser', 'Seeded Notebook: Archive Growth Projection', 'Archive capacity planning checkpoint.', 'Trajectory remains consistent with 240 PB/year growth assumptions.', 'published', 36),
    ('adminuser', 'Seeded Notebook: Inference Drift Incident', 'Incident review for drifted anomaly detector.', 'Drift exceeded tolerance and model was rolled back to stable baseline.', 'published', 38)
) AS seed(author_username, title, description, content, status, hours_ago)
JOIN users u
  ON u.username = seed.author_username
WHERE NOT EXISTS (
  SELECT 1
  FROM posts p
  WHERE p.title = seed.title
);

-- Seed comments that include image links, matching common moderation report categories.
INSERT INTO comments (
  id,
  post_id,
  user_id,
  parent_id,
  content,
  created_at,
  updated_at
)
SELECT
  uuid_generate_v4(),
  p.id,
  u.id,
  NULL,
  'Limited-time broker hack giveaway, click now: http://fake-ops-grant.example [seed:report-spam] ![suspicious ad image](https://picsum.photos/seed/mod-spam-banner/960/540)',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days'
FROM posts p
JOIN users u ON u.username = 'testuser'
WHERE p.title = 'Seeded Notebook: Moderation Scenarios'
  AND NOT EXISTS (
    SELECT 1
    FROM comments c
    WHERE c.content LIKE '%[seed:report-spam]%'
  );

INSERT INTO comments (
  id,
  post_id,
  user_id,
  parent_id,
  content,
  created_at,
  updated_at
)
SELECT
  uuid_generate_v4(),
  p.id,
  u.id,
  NULL,
  'You are incompetent and should leave this project. [seed:report-harassment] ![annotated screenshot](https://picsum.photos/seed/mod-harassment-shot/960/540)',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days'
FROM posts p
JOIN users u ON u.username = 'testuser'
WHERE p.title = 'Seeded Notebook: Moderation Scenarios'
  AND NOT EXISTS (
    SELECT 1
    FROM comments c
    WHERE c.content LIKE '%[seed:report-harassment]%'
  );

INSERT INTO comments (
  id,
  post_id,
  user_id,
  parent_id,
  content,
  created_at,
  updated_at
)
SELECT
  uuid_generate_v4(),
  p.id,
  u.id,
  NULL,
  'Telemetry from this one frame proves a guaranteed supernova next week. [seed:report-misinfo] ![chart crop](https://picsum.photos/seed/mod-misinfo-plot/960/540)',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days'
FROM posts p
JOIN users u ON u.username = 'testuser'
WHERE p.title = 'Seeded Notebook: Moderation Scenarios'
  AND NOT EXISTS (
    SELECT 1
    FROM comments c
    WHERE c.content LIKE '%[seed:report-misinfo]%'
  );

-- Seed moderation reports with pending/reviewed/dismissed states.
INSERT INTO comment_reports (
  id,
  comment_id,
  user_id,
  reason,
  description,
  status,
  created_at,
  resolved_at,
  resolved_by
)
SELECT
  uuid_generate_v4(),
  c.id,
  reporter.id,
  'spam',
  'Repeated off-platform solicitation and suspicious external link. [seed:moderation-report-spam]',
  'pending',
  NOW() - INTERVAL '2 days',
  NULL,
  NULL
FROM comments c
JOIN users reporter ON reporter.username = 'adminuser'
WHERE c.content LIKE '%[seed:report-spam]%'
  AND NOT EXISTS (
    SELECT 1
    FROM comment_reports r
    WHERE r.description LIKE '%[seed:moderation-report-spam]%'
  );

INSERT INTO comment_reports (
  id,
  comment_id,
  user_id,
  reason,
  description,
  status,
  created_at,
  resolved_at,
  resolved_by
)
SELECT
  uuid_generate_v4(),
  c.id,
  reporter.id,
  'harassment',
  'Personal attack language directed at another contributor. [seed:moderation-report-harassment]',
  'reviewed',
  NOW() - INTERVAL '36 hours',
  NOW() - INTERVAL '18 hours',
  resolver.id
FROM comments c
JOIN users reporter ON reporter.username = 'adminuser'
JOIN users resolver ON resolver.username = 'adminuser'
WHERE c.content LIKE '%[seed:report-harassment]%'
  AND NOT EXISTS (
    SELECT 1
    FROM comment_reports r
    WHERE r.description LIKE '%[seed:moderation-report-harassment]%'
  );

INSERT INTO comment_reports (
  id,
  comment_id,
  user_id,
  reason,
  description,
  status,
  created_at,
  resolved_at,
  resolved_by
)
SELECT
  uuid_generate_v4(),
  c.id,
  reporter.id,
  'misinformation',
  'Extraordinary claim without evidence; flagged for review. [seed:moderation-report-misinfo]',
  'dismissed',
  NOW() - INTERVAL '30 hours',
  NOW() - INTERVAL '12 hours',
  resolver.id
FROM comments c
JOIN users reporter ON reporter.username = 'adminuser'
JOIN users resolver ON resolver.username = 'adminuser'
WHERE c.content LIKE '%[seed:report-misinfo]%'
  AND NOT EXISTS (
    SELECT 1
    FROM comment_reports r
    WHERE r.description LIKE '%[seed:moderation-report-misinfo]%'
  );

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cosmic_horizons_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cosmic_horizons_user;
GRANT USAGE ON SCHEMA public TO cosmic_horizons_user;
