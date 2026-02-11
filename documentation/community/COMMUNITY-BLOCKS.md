# Community Blocks Specification

## Overview

VLASS Portal lets users create community posts with **Markdown + embedded viewer blocks + images**, with revision history, snapshots, and moderation.

This is the core differentiator: users can tell stories about VLASS data, link observations to discussion.

---

## Part 1: Data Model

### Posts Table

```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES users(id),

  -- Identity

  slug STRING UNIQUE,              -- URL-friendly: "m87-core-observation"

  status ENUM('DRAFT', 'PUBLISHED', 'HIDDEN', 'DELETED'),

  -- Latest revision pointer

  latest_revision_id UUID,         -- FK to post_revisions.id

  revision_count INT DEFAULT 1,

  -- Metadata

  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  published_at TIMESTAMP,          -- When first published

  hidden_at TIMESTAMP,             -- When hidden by mod

  hidden_reason STRING,            -- e.g., "Spam", "Misinformation"

  -- Engagement & moderation

  comment_count INT DEFAULT 0,
  flag_count INT DEFAULT 0,
  flagged BOOL DEFAULT FALSE,      -- Flagged after 3+ reports

  locked BOOL DEFAULT FALSE,       -- Comments disabled

  -- Search

  search_vector TSVECTOR,          -- Full-text search (Postgres)

  -- Snapshot artifact

  snapshot_artifact_id STRING,     -- S3 key (optional)

  snapshot_generated_at TIMESTAMP
);

CREATE TABLE post_revisions (
  id UUID PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id),

  -- Content

  rev_number INT,                  -- 1, 2, 3, ...

  title STRING,
  markdown_raw TEXT,               -- Raw Markdown (user edited)

  -- Extracted data (deterministic parsing)

  blocks_json JSONB,               -- Extracted blocks (viewer, image, etc.)

  tags_json JSONB,                 -- Extracted tags (curated + user)

  -- Author & audit

  author_id UUID,                  -- May differ from post.author_id if admin edited

  edited_reason STRING,            -- Why revision was made

  created_at TIMESTAMP,

  -- Metadata

  word_count INT,
  is_snapshot_ready BOOL,          -- Was snapshot generated?

  snapshot_job_id STRING,          -- Async job tracking

  -- Search

  search_vector TSVECTOR
);

CREATE TABLE post_block_snapshots (
  id UUID PRIMARY KEY,
  revision_id UUID NOT NULL REFERENCES post_revisions(id),

  -- Which block?

  block_index INT,
  block_type ENUM('VIEWER', 'IMAGE', 'CODE'),

  -- Generated artifact

  artifact_s3_key STRING,          -- Where snapshot PNG is stored

  artifact_url_signed STRING,      -- Signed URL (100-char cache)

  artifact_size_bytes BIGINT,
  artifact_generated_at TIMESTAMP,

  -- Lifecycle

  artifact_expires_at TIMESTAMP,   -- 30-day TTL

  artifact_is_deleted BOOL
);

```

### Post Revisions & Immutability

One publish operation creates one revision (immutable snapshot):

```text
Publish v1 → post_revisions[1]
  ├─ title, markdown, extracted blocks, tags
  ├─ (optional) triggers snapshot generation job
  ├─ emits: AUDIT_EVENT(action=POST_CREATED)

User edits, re-publishes → post_revisions[2]
  ├─ new title/markdown
  ├─ new blocks extraction
  ├─ post.latest_revision_id points to [2]
  ├─ post.revision_count = 2
  ├─ emits: AUDIT_EVENT(action=POST_REVISED)

Mod hides post → post.status = 'HIDDEN', hidden_at = now()
  ├─ post.hidden_reason = "Spam" (or audit reason)
  ├─ revisions intact (not deleted)
  ├─ emits: AUDIT_EVENT(action=POST_HIDDEN)

User deletes post → post.status = 'DELETED', deleted_at = now()
  ├─ soft delete; data retained 30d for recovery
  ├─ emits: AUDIT_EVENT(action=POST_DELETED)
  ├─ after 30d: hard delete (cascade delete revisions, artifacts)

```

---

## Part 2: Markdown Grammar & Block Extraction

### Markdown Syntax

Users write standard Markdown + special block notations:

````markdown

# M87 Core Observation

Here's what we observed in the VLASS Quick Look data.

## Viewer Block

```viewer
{
  "title": "M87 Core at 3 GHz",
  "epoch": "ql_rms",
  "center": {
    "raDeg": 187.7059,
    "decDeg": 12.3911
  },
  "fovDeg": 0.1,
  "colormap": "viridis",
  "overlayGrid": true,
  "overlayCompass": true,
  "timestampUtc": "2026-02-11T20:00:00Z"
}

```

````

The core shows a clear ring structure.

## Curated Tags

```tags

- spectral-line-search

- supermassive-black-hole

- compact-core

```

## Image

![M87 Snapshot](<uploaded-image-url>)

Regular text follows...

````text

### Block Extraction (Deterministic Parser)

NestJS controller runs a parser **on every publish**:

```typescript
// apps/vlass-api/src/app/community/parsers/markdown-blocks.parser.ts

export function extractBlocks(rawMarkdown: string): Block[] {
  const blocks: Block[] = [];

  // Regex: fenced code blocks with language specifier
  const blockRegex = /```(\w+)\n([\s\S]*?)\n```/g;
  let match;

  while ((match = blockRegex.exec(rawMarkdown)) !== null) {
    const language = match[1];
    const content = match[2];

    if (language === "viewer") {
      const viewerConfig = JSON.parse(content);
      blocks.push({
        type: "VIEWER",
        index: blocks.length,
        config: viewerConfig,
        // Validation happens here
        validation: validateViewerConfig(viewerConfig),
      });
    }

    if (language === "tags") {
      const tags = content.split("\n")
        .filter(line => line.startsWith("-"))
        .map(line => line.slice(2).trim());

      blocks.push({
        type: "TAGS",
        index: blocks.length,
        data: { tags },
      });
    }

    if (language === "image") {
      // Validate image URL (must be user's upload)
      blocks.push({
        type: "IMAGE",
        index: blocks.length,
        data: { url: content.trim() },
      });
    }
  }

  return blocks;
}

function validateViewerConfig(config: any): { valid: bool, errors: string[] } {
  const errors = [];

  if (!config.epoch || !["ql_rms", "epoch_01", "epoch_02"].includes(config.epoch)) {
    errors.push("epoch must be ql_rms or epoch_XX");
  }

  if (typeof config.center?.raDeg !== "number" || config.center.raDeg < 0 || config.center.raDeg > 360) {
    errors.push("center.raDeg must be 0-360");
  }

  if (typeof config.fovDeg !== "number" || config.fovDeg <= 0 || config.fovDeg > 180) {
    errors.push("fovDeg must be 0-180");
  }

  return { valid: errors.length === 0, errors };
}

````

### Stored Representation (post_revisions.blocks_json)

After parsing, store as JSON (deterministic, queryable):

```json
[
  {
    "type": "VIEWER",
    "index": 0,
    "config": {
      "title": "M87 Core at 3 GHz",
      "epoch": "ql_rms",
      "center": { "raDeg": 187.7059, "decDeg": 12.3911 },
      "fovDeg": 0.1,
      "colormap": "viridis",
      "overlayGrid": true
    },
    "validation": { "valid": true, "errors": [] },
    "snapshot": {
      "jobId": "snapshot_abc123",
      "status": "COMPLETE",
      "artifactId": "s3://vlass-artifacts/post_123_block_0.png",
      "generatedAt": "2026-02-11T20:15:00Z"
    }
  },
  {
    "type": "TAGS",
    "index": 1,
    "data": {
      "tags": [
        "spectral-line-search",
        "supermassive-black-hole",
        "compact-core"
      ],
      "curatedMatch": {
        "spectral-line-search": {
          "id": "tag_123",
          "category": "observation-type"
        },
        "supermassive-black-hole": {
          "id": "tag_456",
          "category": "object-type"
        }
      },
      "userCreated": ["compact-core"]
    }
  },
  {
    "type": "IMAGE",
    "index": 2,
    "data": {
      "url": "/uploads/user_1/m87-snapshot.png",
      "uploadedAt": "2026-02-11T20:00:00Z",
      "metadata": {
        "width": 512,
        "height": 512,
        "format": "png",
        "size": 102400
      }
    }
  }
]

```

---

## Part 3: Snapshot Artifact Generation

When a post with viewer blocks is published:

### Synchronous Validation

```typescript
@Post("posts")
async createPost(
  @Body() dto: CreatePostDto,
  @Request() req
): Promise<PostDto> {
  const user = req.user;

  // Parse blocks immediately (fail fast if invalid)
  const blocks = extractBlocks(dto.markdown);

  const invalidBlocks = blocks.filter(b =>
    b.type === "VIEWER" && !b.validation.valid
  );

  if (invalidBlocks.length > 0) {
    throw new BadRequestException({
      message: "Markdown contains invalid viewer blocks",
      errors: invalidBlocks.map(b => b.validation.errors),
    });
  }

  // Valid markdown → create revision + queue snapshots

  const post = await this.posts.createPost(user.id, {
    markdown: dto.markdown,
    blocks,
    title: dto.title,
  });

  // Return immediately (async jobs queued)
  return toDto(post);  // 201 Created, POST complete
}

```

### Async Snapshot Job (Background)

```typescript
// apps/vlass-api/src/app/community/jobs/snapshot.job.ts

@Processor('snapshot-generation')
export class SnapshotGenerationJob {
  constructor(
    private rust: RustService,
    private s3: S3Service,
    private db: PrismaService,
    private ws: WsGateway,
  ) {}

  @Process()
  async generateSnapshot(
    job: Job<{
      postId: string;
      revisionId: string;
      blockIndex: number;
      viewerConfig: any;
    }>,
  ): Promise<{ artifactId: string }> {
    const { postId, revisionId, blockIndex, viewerConfig } = job.data;

    try {
      // Call Rust service: generate preview
      const previewPng = await this.rust.preview({
        epoch: viewerConfig.epoch,
        ra: viewerConfig.center.raDeg,
        dec: viewerConfig.center.decDeg,
        fov: viewerConfig.fovDeg,
        width: 512,
        height: 512,
        format: 'png',
        colormap: viewerConfig.colormap,
      });

      // Upload to S3
      const key = `posts/${postId}/block_${blockIndex}.png`;
      await this.s3.upload(key, previewPng, {
        ContentType: 'image/png',
        Metadata: {
          postId,
          blockIndex: String(blockIndex),
          generatedAt: new Date().toISOString(),
        },
      });

      // Get signed URL (valid for 7 days, then expires)
      const signedUrl = await this.s3.getSignedUrl(key, {
        expiresIn: 7 * 24 * 60 * 60,

      });

      // Update database
      await this.db.postBlockSnapshot.upsert({
        where: {
          revision_id_block_index: {
            revision_id: revisionId,
            block_index: blockIndex,
          },
        },
        update: {
          artifact_s3_key: key,
          artifact_url_signed: signedUrl,
          artifact_generated_at: new Date(),
          artifact_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),

        },
        create: {
          id: uuid(),
          revision_id: revisionId,
          block_index: blockIndex,
          block_type: 'VIEWER',
          artifact_s3_key: key,
          artifact_url_signed: signedUrl,
          artifact_generated_at: new Date(),
          artifact_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),

        },
      });

      // Notify client via WebSocket
      this.ws.broadcastJobEvent({
        type: 'SNAPSHOT_COMPLETE',
        postId,
        blockIndex,
        snapshotUrl: signedUrl,
        timestamp: new Date(),
      });

      return { artifactId: key };
    } catch (error) {
      this.logger.error(`Snapshot generation failed for post ${postId}`, error);

      // Notify client: failed
      this.ws.broadcastJobEvent({
        type: 'SNAPSHOT_FAILED',
        postId,
        blockIndex,
        error: error.message,
        timestamp: new Date(),
      });

      throw error; // Bull will retry
    }
  }
}

```

### WebSocket Events

```typescript
// Client (Angular) listens to jobs stream

interface JobEvent {
  type:
    | 'SNAPSHOT_QUEUED'
    | 'SNAPSHOT_PROGRESS'
    | 'SNAPSHOT_COMPLETE'
    | 'SNAPSHOT_FAILED';
  postId: string;
  blockIndex: number;
  timestamp: string;

  // PROGRESS
  pct?: number;

  // COMPLETE
  snapshotUrl?: string;

  // FAILED
  error?: string;
}

```

---

## Part 4: Moderation Interactions

### Flagging a Post

When 3+ users report a post with reason:

```typescript
// User reports post
await this.posts.reportPost(postId, userId, 'SPAM');

// Check if flagged now
const post = await db.post.findUnique({ where: { id: postId } });
if (post.flag_count >= 3 && !post.flagged) {
  await db.post.update({
    where: { id: postId },
    data: { flagged: true },
  });

  // Emit to moderation queue
  this.ws.broadcastModEvent({
    type: 'QUEUE_ITEM',
    queue: 'flagged_posts',
    postId,
    reportCount: post.flag_count,
  });
}

```

### Mod Action: Hide Post

```typescript
@Patch("posts/:id/hide")
@UseGuards(JwtGuard, RolesGuard("MOD", "ADMIN"))
async hidePost(
  @Param("id") postId: string,
  @Body() dto: { reason: string }
): Promise<PostDto> {
  const post = await db.post.update({
    where: { id: postId },
    data: {
      status: "HIDDEN",
      hidden_at: new Date(),
      hidden_reason: dto.reason,
    },
  });

  // Audit
  await this.audit.log({
    action: "POST_HIDDEN",
    actor_id: req.user.id,
    actor_role: req.user.role,
    resource: { postId },
    reason: dto.reason,
    timestamp: new Date(),
  });

  // Delete artifacts
  const revisions = await db.postRevision.findMany({ where: { post_id: postId } });
  for (const rev of revisions) {
    const snapshots = await db.postBlockSnapshot.findMany({ where: { revision_id: rev.id } });
    for (const snap of snapshots) {
      if (snap.artifact_s3_key) {
        await this.s3.delete(snap.artifact_s3_key);
      }
    }
  }

  return toDto(post);
}

```

### Mod Action: Lock Comments on Post

```typescript
@Patch("posts/:id/lock")
@UseGuards(JwtGuard, RolesGuard("MOD", "ADMIN"))
async lockPost(
  @Param("id") postId: string,
): Promise<PostDto> {
  const post = await db.post.update({
    where: { id: postId },
    data: { locked: true },
  });

  await this.audit.log({
    action: "POST_LOCKED",
    actor_id: req.user.id,
    resource: { postId },
  });

  return toDto(post);
}

```

### Mod Action: Tag for "Needs Sources"

```typescript
@Post("posts/:id/tag-needs-sources")
@UseGuards(JwtGuard, RolesGuard("MOD", "ADMIN"))
async addNeedsSourcesTag(
  @Param("id") postId: string,
): Promise<PostDto> {
  const post = await db.post.update({
    where: { id: postId },
    data: {
      tags: [...(post.tags || []), "needs-sources"],
    },
  });

  return toDto(post);
}

```

---

## Part 5: Revision History API

### Get All Revisions for a Post

```typescript
GET /api/v1/posts/:postId/revisions

Response:
{
  "postId": "post_123",
  "revisions": [
    {
      "revNumber": 1,
      "title": "M87 Core Observation",
      "createdAt": "2026-02-11T20:00:00Z",
      "modifiedBy": "user_1",
      "wordCount": 345,
      "hasSnapshot": true,
      "snapshotUrl": "https://...",
      "snapshot": [
        { "blockIndex": 0, "type": "VIEWER", "url": "..." },
        { "blockIndex": 1, "type": "TAGS", "data": { ... } }
      ]
    },
    {
      "revNumber": 2,
      "title": "M87 Core Observation (Updated)",
      "createdAt": "2026-02-11T21:30:00Z",
      "modifiedBy": "user_1",
      "editReason": "Fixed colormap typo",
      ...
    }
  ]
}

```

### Diff Between Revisions

```typescript
GET /api/v1/posts/:postId/revisions/:revNumber/diff?vs=:prevRevNumber

Response:
{
  "from": 1,
  "to": 2,
  "changes": {
    "title": {
      "old": "M87 Core Observation",
      "new": "M87 Core Observation (Updated)"
    },
    "blocks": [
      {
        "type": "VIEWER",
        "index": 0,
        "changed": ["colormap"],
        "old": "hot",
        "new": "viridis"
      }
    ]
  }
}

```

---

## Part 6: Testing

````typescript
// apps/vlass-api-e2e/src/community-blocks.spec.ts

describe("Community Posts with Blocks", () => {
  it("should publish post with valid viewer block", async () => {
    const res = await request
      .post("/api/v1/posts")
      .auth("user_1")
      .send({
        title: "M87 Observation",
        markdown: `

# M87

\`\`\`viewer
{
  "epoch": "ql_rms",
  "center": { "raDeg": 187.7059, "decDeg": 12.3911 },
  "fovDeg": 0.1
}
\`\`\`
`,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe("PUBLISHED");
  });

  it("should reject post with invalid viewer block", async () => {
    const res = await request
      .post("/api/v1/posts")
      .auth("user_1")
      .send({
        title: "Bad Post",
        markdown: `
\`\`\`viewer
{ "epoch": "invalid" }
\`\`\`
`,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("invalid");
  });

  it("should generate snapshots asynchronously", async () => {
    const createRes = await request
      .post("/api/v1/posts")
      .auth("user_1")
      .send({ title: "Test", markdown: "```viewer\n{...}\n```" });

    const postId = createRes.body.id;

    // Poll for snapshot completion (via WS or GET /posts/:id)
    let post;
    let retries = 0;
    while (retries < 50) {
      const getRes = await request.get(`/api/v1/posts/${postId}`).auth("user_1");
      post = getRes.body;

      if (post.snapshotUrl) break;
      await sleep(1000);
      retries++;
    }

    expect(post.snapshotUrl).toBeDefined();
    expect(post.snapshotUrl).toMatch(/^https?:\/\//);
  });

  it("should create new revision on edit", async () => {
    const createRes = await request.post("/api/v1/posts").auth("user_1").send({ ... });
    const postId = createRes.body.id;

    await request
      .patch(`/api/v1/posts/${postId}`)
      .auth("user_1")
      .send({
        markdown: "Updated content",
        editReason: "Fixed typo",
      });

    const revisionsRes = await request
      .get(`/api/v1/posts/${postId}/revisions`)
      .auth("user_1");

    expect(revisionsRes.body.revisions).toHaveLength(2);
    expect(revisionsRes.body.revisions[1].revNumber).toBe(2);
  });

  it("should hide post and delete artifacts", async () => {
    const createRes = await request.post("/api/v1/posts").auth("user_1").send({ ... });
    const postId = createRes.body.id;

    const hideRes = await request
      .patch(`/api/v1/posts/${postId}/hide`)
      .auth("mod_user")
      .send({ reason: "Spam" });

    expect(hideRes.status).toBe(200);
    expect(hideRes.body.status).toBe("HIDDEN");

    // Artifacts deleted
    // (verify S3 calls made)
  });
});

````

---

## Part 7: FAQ / Design Decisions

**Q: Why immutable revisions instead of inline edits?**
A: Preserves edit history for transparency and moderation. Easy to diff, revert, or audit.

**Q: Why store blocks as JSON instead of markdown?**
A: Queryable (find all posts with a specific epoch). Faster rendering (no re-parse on every view). Easier to validate and version independently.

**Q: Why generate snapshots async?**
A: Tile rendering can take 1-5 seconds. User shouldn't wait. Async job + WS notification gives great UX.

**Q: Why 30-day TTL on artifacts?**
A: Balances storage cost vs. user expectations. Posts are usually accessed within days of creation.

**Q: Can users edit blocks after publish?**
A: Yes, via creating a new revision. Old revision's snapshot is preserved (immutable).

---

**Last Updated:** 2026-02-11
**Status:** NORMATIVE

## **Related:** HIPS-PIPELINE.md, MODERATION-SYSTEM.md, DATA-RETENTION-DELETION.md
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
