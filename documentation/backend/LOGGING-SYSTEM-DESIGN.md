# VLASS Portal Logging System (MVP)

**Date:** 2026-02-07  
**Status:** DESIGN PHASE  
**Owner:** Architecture Team  
**Audience:** Engineering (implementation guide)

---

## Overview

Comprehensive request/event logging system with:

- **Dual-layer storage:** Redis (cache) + PostgreSQL (persistent)
- **Universal instrumentation:** HTTP interceptors (frontend + backend) + WebSocket logging + application events
- **Admin dashboard:** Material Data Table with RBAC, filtering, and search
- **Real-time insights:** Log count tiles by severity/type

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [What Gets Logged](#what-gets-logged)
3. [Storage Strategy](#storage-strategy)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Backend Implementation](#backend-implementation)
7. [Frontend Implementation](#frontend-implementation)
8. [Admin Dashboard UI](#admin-dashboard-ui)
9. [RBAC & Security](#rbac--security)
10. [Implementation Timeline](#implementation-timeline)

---

## System Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Angular)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  HTTP Interceptor             WebSocket Logger                │
│  ├─ Outgoing requests         ├─ Connection events            │
│  ├─ Responses                 ├─ Messages sent/received       │
│  ├─ Errors (4xx, 5xx)         ├─ Disconnections              │
│  └─ Timing/perf               └─ Errors                      │
│         │                            │                        │
│         └────────────┬───────────────┘                        │
│                      │                                        │
│                 POST /api/logs/batch                         │
│                      │                                        │
└─────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (NestJS)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  HTTP Interceptor             Application Logger              │
│  ├─ Incoming requests         ├─ Auth events                  │
│  ├─ Authorization info        ├─ Business logic events       │
│  ├─ Responses                 ├─ Database operations         │
│  ├─ Errors                    ├─ Publish/revision events     │
│  └─ Timing                    └─ Custom domain events        │
│         │                            │                        │
│         └────────────┬───────────────┘                        │
│                      │                                        │
│              LogService (NestJS)                             │
│              ├─ Normalize log entry                          │
│              ├─ Add metadata (timestamp, user, ip)           │
│              └─ Batch queue (debounce writes)               │
│                      │                                        │
│         ┌────────────┴───────────────┐                       │
│         │                            │                       │
│         ▼                            ▼                       │
│      Redis                      PostgreSQL                   │
│      (Hot cache)                (Persistent)                │
│      ├─ 7-day TTL              ├─ Retention per config      │
│      ├─ Fast index             ├─ Indexed for search        │
│      └─ ~100k entries          └─ Archive capability        │
│                                                              │
└─────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│            ADMIN DASHBOARD (Material Table)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─ Count Tiles (Filter by Type) ─────────────────────────┐  │
│  │ [All: 1,240] [HTTP: 856] [Event: 234] [Error: 150]   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ Search & Filters ────────────────────────────────────┐   │
│  │ Search: [________________] Type: [All ▼] User: [All ▼] │  │
│  │ Severity: [All ▼]  Status: [All ▼]                    │   │
│  │ Date Range: [From ___] [To ___]                        │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌─ Results Table ───────────────────────────────────────┐   │
│  │ Type │ Severity │ User │ IP │ Endpoint │ Status │ Time │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ HTTP │ Info     │ jane │    │ POST     │ 201    │ 2s   │   │
│  │ HTTP │ Error    │ john │    │ GET      │ 500    │ 5s   │   │
│  │ EVT  │ Info     │ -    │    │ Publish  │ -      │ 1s   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
│  [Prev] [1 2 3 4 5] [Next]  (100 items shown)               │
│                                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## What Gets Logged

### **HTTP Requests (Frontend)**

```typescript
{
  type: 'HTTP_REQUEST',
  method: 'POST',
  url: '/api/posts',
  status: 201,
  statusText: 'Created',
  duration_ms: 234,
  user_agent: 'Mozilla/5.0...',
  timestamp: '2026-02-07T22:30:45.123Z',
  client_ip: '192.168.1.100',  // If available, else omit
  headers: {
    'content-type': 'application/json',
    'authorization': '[REDACTED]'  // Never log auth tokens
  },
  request_body_size: 1024,
  response_body_size: 512,
  error_message: null
}
```

### **HTTP Requests (Backend)**

```typescript
{
  type: 'HTTP_REQUEST',
  method: 'POST',
  path: '/api/posts',
  user_id: 'user-123',
  user_email: 'jane@vlass.local',
  status_code: 201,
  duration_ms: 145,
  ip_address: '192.168.1.100',
  timestamp: '2026-02-07T22:30:45.123Z',
  request_body: '{"title":"..."}',  // Truncate if large
  response_body: '{"id":"post-1"}',  // Truncate
  error_message: null,
  stack_trace: null
}
```

### **WebSocket Events**

```typescript
{
  type: 'WEBSOCKET',
  event: 'connection' | 'message' | 'disconnect' | 'error',
  user_id: 'user-123',
  timestamp: '2026-02-07T22:30:45.123Z',
  duration_ms: 1200,  // For full connection
  message_count: 5,
  error_message: null
}
```

### **Application Events**

```typescript
// Auth event
{
  type: 'EVENT',
  event_name: 'USER_LOGIN',
  severity: 'INFO',
  user_id: 'user-123',
  user_email: 'jane@vlass.local',
  ip_address: '192.168.1.100',
  timestamp: '2026-02-07T22:30:45.123Z',
  details: {
    login_method: 'email',
    success: true,
    mfa_used: false
  },
  error_message: null
}

// Business event
{
  type: 'EVENT',
  event_name: 'POST_PUBLISHED',
  severity: 'INFO',
  user_id: 'user-123',
  entity_type: 'post',
  entity_id: 'post-1',
  timestamp: '2026-02-07T22:30:45.123Z',
  details: {
    title: 'Cool Discovery',
    viewer_blocks_count: 2,
    revision_number: 3
  }
}

// Error event
{
  type: 'EVENT',
  event_name: 'VIEWER_BLOCK_PARSE_ERROR',
  severity: 'ERROR',
  user_id: 'user-456',
  timestamp: '2026-02-07T22:30:45.123Z',
  details: {
    raw_block: '{"invalid json}',
    error_type: 'SyntaxError',
    error_message: 'Unexpected token }'
  }
}
```

### **Event Categories (See Tiles)**

| Category | Count | Examples |
| --- | --- | --- |
| **All** | (sum) | Everything |
| **HTTP** | - | Requests/responses |
| **WebSocket** | - | Connection events |
| **Auth** | - | LOGIN, LOGOUT, REGISTER, AUTH_FAILED |
| **Post** | - | POST_CREATED, POST_PUBLISHED, POST_DELETED |
| **Error** | - | HTTP 5xx, exception stack traces |
| **Info** | - | Informational events |
| **Warning** | - | Deprecations, fallbacks |

---

### **Viewer Runtime Events (Implemented)**

The current MVP viewer now emits runtime events for grid and load timing in dev builds:

```typescript
{
  type: 'EVENT',
  event_name: 'viewer_load_complete' | 'viewer_load_failed' | 'aladin_initialized',
  severity: 'INFO' | 'ERROR',
  details: {
    duration_ms: 1234,
    grid_enabled: false
  },
  timestamp: '2026-02-08T00:00:00.000Z'
}
```

Grid toggle events are logged as:

```typescript
{
  type: 'EVENT',
  event_name: 'grid_toggle_requested' | 'grid_toggle_applied',
  details: {
    previous_enabled: false,
    next_enabled: true,
    reinit_duration_ms: 420
  }
}
```

Backend cache behavior for viewer endpoints is logged with explicit source attribution:

- cutout cache: `memory` | `redis` | `none`
- nearby-label cache: `memory` | `redis` | `none`
- startup cache config summary (Redis enabled, TTLs, warmup enabled)

Example log messages:

```text
Cutout cache hit (source=redis, provider=primary, survey=CDS/P/DSS2/color, size=1024x1024).
Nearby-label cache miss (source=none, limit=16, radius_deg=0.2).
Viewer cache config: redis_enabled=true, cutout_ttl_ms=300000, nearby_ttl_ms=30000, warmup_enabled=true.
```

### **Logger UI Route (Implemented)**

Current MVP includes a built-in logger screen in the web app:

- Route: `/logs`
- Guard: authenticated + admin role
- Data source: frontend in-memory `AppLoggerService` buffer
- Purpose: verify runtime viewer/app events during development

The page currently supports:

- Refresh of local runtime entries
- Event list with timestamp, level, area, event name
- Structured details payload per entry (JSON)

---

## Storage Strategy

### **Redis (Hot Cache)**

**Purpose:** Fast queries for real-time dashboard  
**Retention:** 7 days (TTL)  
**Capacity:** ~100,000 recent log entries  
**Keys:**

- `logs:all` → Sorted set with all logs (score = timestamp)
- `logs:type:HTTP` → Sorted set filtered by type
- `logs:type:EVENT` → Sorted set filtered by type
- `logs:type:WEBSOCKET` → Sorted set filtered by type
- `logs:severity:ERROR` → Sorted set filtered by severity
- `logs:user:{user_id}` → User-specific logs
- `logs:index` → Count of entries

**Operations:**

- Add: `ZADD logs:all <score> <entry_json>`
- Query: `ZRANGE logs:all <start> <end> WITHSCORES`
- Filter: `ZRANGE logs:severity:ERROR 0 -1`
- Count: `ZCARD logs:all`

### **PostgreSQL (Persistent)**

**Purpose:** Long-term storage, audit trail, compliance  
**Retention:** Configurable (default 90 days)  
**Indexes:**

- Primary: `id`
- Composite: `(user_id, created_at)` for user-specific dashboards
- Composite: `(type, severity, created_at)` for filtering
- Single: `created_at` for date range queries
- Single: `user_email` (hashed if sensitive)

**Archival Strategy:**

- After 90 days, move to `logs_archive` table
- Optional: Export archive to S3 for compliance

---

## Database Schema

### **PostgreSQL Table: `logs`**

```sql
CREATE TABLE logs (
  -- PKs
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core fields
  type VARCHAR(32)    NOT NULL,  -- 'HTTP_REQUEST', 'EVENT', 'WEBSOCKET'
  event_name VARCHAR(128),       -- Event name (e.g., 'POST_PUBLISHED')
  severity VARCHAR(16),          -- 'INFO', 'WARNING', 'ERROR'
  
  -- User/context
  user_id UUID,                  -- nullable for public actions
  user_email VARCHAR(255),       -- denormalized for search
  ip_address INET,               -- IP address
  
  -- Request/entity context
  method VARCHAR(16),            -- 'GET', 'POST', 'PUT', 'DELETE'
  path VARCHAR(512),             -- API path or entity type
  status_code SMALLINT,          -- HTTP 200, 404, etc
  entity_type VARCHAR(64),       -- 'post', 'revision', 'user'
  entity_id VARCHAR(255),        -- entity UUID
  
  -- Performance
  duration_ms INT,               -- Request duration (ms)
  
  -- Details (JSON, flexible)
  details JSONB DEFAULT '{}',    -- { title, viewer_blocks_count, error_type, etc }
  request_body TEXT,             -- Truncated request body
  response_body TEXT,            -- Truncated response body
  error_message TEXT,            -- Error message
  stack_trace TEXT,              -- Stack trace (only for errors)
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_type_severity_created (type, severity, created_at),
  INDEX idx_user_created (user_id, created_at),
  INDEX idx_created (created_at),
  INDEX idx_status_code (status_code),
  INDEX idx_details_gin (details) USING GIN
);

-- Archive table (same schema, rotated periodically)
CREATE TABLE logs_archive LIKE logs;

-- Search materialized view
CREATE MATERIALIZED VIEW log_summary AS
SELECT 
  type,
  severity,
  COUNT(*) as count,
  MIN(created_at) as earliest,
  MAX(created_at) as latest
FROM logs
GROUP BY type, severity;
```

---

## API Endpoints

### **Create Log Entry (Batch)**

**Endpoint:** `POST /api/logs/batch`  
**Auth:** Optional (frontend can log before auth)  
**Rate Limit:** 100 req/min (generous for client-side logging)  
**Body:**

```typescript
{
  entries: [
    {
      type: 'HTTP_REQUEST',
      method: 'POST',
      url: '/api/posts',
      status: 201,
      duration_ms: 234,
      timestamp: '2026-02-07T22:30:45.123Z'
    },
    // ... more entries
  ]
}
```

**Response:**

```typescript
{
  success: true,
  count: 3,  // Entries accepted
  message: 'Batch logged'
}
```

---

### **Get Logs (Paginated with Filters)**

**Endpoint:** `GET /api/admin/logs`  
**Auth:** Required + RBAC (admin:read)  
**Query Params:**

```bash
GET /api/admin/logs?
  type=HTTP&
  severity=ERROR&
  user_id=user-123&
  status_code=500&
  page=1&
  limit=50&
  search=POST%20/api/posts&
  from=2026-02-01&
  to=2026-02-07
```

**Response:**

```typescript
{
  data: [
    {
      id: 'log-1',
      type: 'HTTP_REQUEST',
      method: 'POST',
      path: '/api/posts',
      status_code: 201,
      severity: 'INFO',
      user_id: 'user-123',
      user_email: 'jane@vlass.local',
      duration_ms: 234,
      created_at: '2026-02-07T22:30:45.123Z',
      details: { ... }
    },
    // ... more logs
  ],
  pagination: {
    total: 1240,
    page: 1,
    limit: 50,
    pages: 25
  },
  summary: {
    all: 1240,
    http: 856,
    event: 234,
    websocket: 150,
    error: 89,
    warning: 23,
    info: 1128
  }
}
```

---

### **Get Log Counts (For Tiles)**

**Endpoint:** `GET /api/admin/logs/summary`  
**Auth:** Required + RBAC (admin:read)  
**Query Params:**  

```bash
GET /api/admin/logs/summary?from=2026-02-01&to=2026-02-07
```

**Response:**

```typescript
{
  all: 1240,
  http: 856,
  event: 234,
  websocket: 150,
  error: 89,
  warning: 23,
  info: 1128,
  timestamp: '2026-02-07T22:31:00.000Z'
}
```

---

### **Delete Old Logs (Cleanup Job)**

**Endpoint:** `POST /api/admin/logs/cleanup`  
**Auth:** Required + RBAC (admin:write)  
**Body:**

```typescript
{
  retention_days: 90  // Keep logs newer than this
}
```

**Response:**

```typescript
{
  deleted_count: 12340,
  remaining_count: 8920,
  message: 'Cleanup complete'
}
```

---

## Backend Implementation

### **1. Log Entity (TypeORM)**

**File:** `apps/vlass-api/src/app/entities/log.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('logs')
@Index('idx_type_severity_created', ['type', 'severity', 'created_at'])
@Index('idx_user_created', ['user_id', 'created_at'])
@Index('idx_created', ['created_at'])
@Index('idx_status_code', ['status_code'])
export class Log {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32 })
  type!: string; // 'HTTP_REQUEST', 'EVENT', 'WEBSOCKET'

  @Column({ type: 'varchar', length: 128, nullable: true })
  event_name?: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  severity?: string; // 'INFO', 'WARNING', 'ERROR'

  @Column({ type: 'uuid', nullable: true })
  user_id?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user_email?: string;

  @Column({ type: 'inet', nullable: true })
  ip_address?: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  method?: string; // HTTP method

  @Column({ type: 'varchar', length: 512, nullable: true })
  path?: string;

  @Column({ type: 'smallint', nullable: true })
  status_code?: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  entity_type?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  entity_id?: string;

  @Column({ type: 'int', nullable: true })
  duration_ms?: number;

  @Column({ type: 'jsonb', default: {} })
  details!: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  request_body?: string;

  @Column({ type: 'text', nullable: true })
  response_body?: string;

  @Column({ type: 'text', nullable: true })
  error_message?: string;

  @Column({ type: 'text', nullable: true })
  stack_trace?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
```

---

### **2. Log Repository**

**File:** `apps/vlass-api/src/app/repositories/log.repository.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Log } from '../entities/log.entity';

@Injectable()
export class LogRepository {
  constructor(
    @InjectRepository(Log)
    private readonly repo: Repository<Log>,
  ) {}

  async create(log: Partial<Log>): Promise<Log> {
    const entity = this.repo.create(log);
    return this.repo.save(entity);
  }

  async createBatch(logs: Partial<Log>[]): Promise<Log[]> {
    const entities = this.repo.create(logs);
    return this.repo.save(entities);
  }

  async findPaginated(
    page: number = 1,
    limit: number = 50,
    filters: {
      type?: string;
      severity?: string;
      user_id?: string;
      status_code?: number;
      search?: string;
      from?: Date;
      to?: Date;
    } = {},
  ): Promise<{ data: Log[]; total: number }> {
    let query = this.repo.createQueryBuilder('log');

    if (filters.type) {
      query = query.andWhere('log.type = :type', { type: filters.type });
    }
    if (filters.severity) {
      query = query.andWhere('log.severity = :severity', {
        severity: filters.severity,
      });
    }
    if (filters.user_id) {
      query = query.andWhere('log.user_id = :user_id', {
        user_id: filters.user_id,
      });
    }
    if (filters.status_code) {
      query = query.andWhere('log.status_code = :status_code', {
        status_code: filters.status_code,
      });
    }
    if (filters.search) {
      query = query.andWhere(
        '(log.path ILIKE :search OR log.user_email ILIKE :search OR log.error_message ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }
    if (filters.from) {
      query = query.andWhere('log.created_at >= :from', {
        from: filters.from,
      });
    }
    if (filters.to) {
      query = query.andWhere('log.created_at <= :to', { to: filters.to });
    }

    const total = await query.getCount();
    const data = await query
      .orderBy('log.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total };
  }

  async getSummary(from?: Date, to?: Date): Promise<Record<string, number>> {
    let query = this.repo
      .createQueryBuilder('log')
      .select('log.type', 'type')
      .addSelect('log.severity', 'severity')
      .addSelect('COUNT(*)', 'count');

    if (from) {
      query = query.andWhere('log.created_at >= :from', { from });
    }
    if (to) {
      query = query.andWhere('log.created_at <= :to', { to });
    }

    const results = await query.groupBy('log.type, log.severity').getRawMany();

    const summary: Record<string, number> = {
      all: 0,
      http: 0,
      event: 0,
      websocket: 0,
      error: 0,
      warning: 0,
      info: 0,
    };

    for (const row of results) {
      const typeKey = row.type.toLowerCase();
      const severityKey = row.severity?.toLowerCase() || 'info';
      summary[typeKey] = (summary[typeKey] || 0) + parseInt(row.count);
      summary[severityKey] = (summary[severityKey] || 0) + parseInt(row.count);
      summary.all += parseInt(row.count);
    }

    return summary;
  }

  async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.repo.delete({
      created_at: LessThanOrEqual(cutoffDate),
    });

    return result.affected || 0;
  }
}
```

---

### **3. Log Service**

**File:** `apps/vlass-api/src/app/services/log.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { LogRepository } from '../repositories/log.repository';
import { Log } from '../entities/log.entity';

@Injectable()
export class LogService {
  private readonly logger = new Logger(LogService.name);
  private logQueue: Partial<Log>[] = [];
  private queueTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private logRepository: LogRepository,
  ) {
    // Auto-flush queue every 5 seconds
    this.startQueueFlush();
  }

  /**
   * Queue a log entry for batch persistence
   */
  async queueLog(entry: Partial<Log>): Promise<void> {
    this.logQueue.push({
      ...entry,
      created_at: new Date(),
    });

    // Flush if queue is large
    if (this.logQueue.length >= 100) {
      await this.flushQueue();
    }
  }

  /**
   * Flush queued logs to Redis + PostgreSQL
   */
  async flushQueue(): Promise<void> {
    if (this.logQueue.length === 0) return;

    const batch = [...this.logQueue];
    this.logQueue = [];

    try {
      // Write to Redis (async, don't await)
      this.writeToRedis(batch).catch((err) =>
        this.logger.error(`Redis write failed: ${err.message}`),
      );

      // Write to PostgreSQL (sync)
      await this.logRepository.createBatch(batch);
      this.logger.debug(`Flushed ${batch.length} logs to database`);
    } catch (error) {
      this.logger.error(
        `Log flush failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Re-queue failed entries
      this.logQueue.unshift(...batch);
    }
  }

  /**
   * Write to Redis cache
   */
  private async writeToRedis(entries: Partial<Log>[]): Promise<void> {
    for (const entry of entries) {
      const json = JSON.stringify(entry);
      const timestamp = (entry.created_at as Date).getTime();

      // Add to sorted set by timestamp
      await this.cacheManager.store.client.zadd('logs:all', timestamp, json);

      // Index by type
      if (entry.type) {
        await this.cacheManager.store.client.zadd(
          `logs:type:${entry.type}`,
          timestamp,
          json,
        );
      }

      // Index by severity
      if (entry.severity) {
        await this.cacheManager.store.client.zadd(
          `logs:severity:${entry.severity}`,
          timestamp,
          json,
        );
      }

      // Index by user
      if (entry.user_id) {
        await this.cacheManager.store.client.zadd(
          `logs:user:${entry.user_id}`,
          timestamp,
          json,
        );
      }
    }

    // Set TTL on all keys (7 days)
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    await this.cacheManager.store.client.expire('logs:all', sevenDaysMs);
  }

  /**
   * Start timer to auto-flush queue
   */
  private startQueueFlush(): void {
    this.queueTimer = setInterval(async () => {
      if (this.logQueue.length > 0) {
        await this.flushQueue();
      }
    }, 5000); // Every 5 seconds
  }

  /**
   * Stop queue timer (on app shutdown)
   */
  onModuleDestroy(): void {
    if (this.queueTimer) {
      clearInterval(this.queueTimer);
    }
    // Flush remaining logs
    this.flushQueue().catch((err) =>
      this.logger.error(`Final flush failed: ${err.message}`),
    );
  }
}
```

---

### **4. HTTP Interceptor (Backend)**

**File:** `apps/vlass-api/src/app/interceptors/logging.interceptor.ts`

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, catchError, tap } from 'rxjs';
import { LogService } from '../services/log.service';
import { Log } from '../entities/log.entity';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private logService: LogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const startTime = Date.now();
    const { method, path, query, body, user, ip } = request;

    return next.pipe(
      tap(async (responseData) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        const logEntry: Partial<Log> = {
          type: 'HTTP_REQUEST',
          method,
          path,
          status_code: statusCode,
          user_id: user?.id,
          user_email: user?.email,
          ip_address: ip,
          duration_ms: duration,
          severity: statusCode >= 400 ? 'ERROR' : 'INFO',
          request_body:
            JSON.stringify(this.redactSensitive(body)).substring(0, 1000) ||
            null,
          response_body: JSON.stringify(responseData).substring(0, 1000) || null,
          details: {
            query,
            user_agent: request.headers['user-agent'],
          },
        };

        await this.logService.queueLog(logEntry);
      }),
      catchError(async (error) => {
        const duration = Date.now() - startTime;

        const logEntry: Partial<Log> = {
          type: 'HTTP_REQUEST',
          method,
          path,
          status_code: response.statusCode || 500,
          user_id: user?.id,
          user_email: user?.email,
          ip_address: ip,
          duration_ms: duration,
          severity: 'ERROR',
          error_message: error.message,
          stack_trace: error.stack,
          details: {
            error_type: error.constructor.name,
          },
        };

        await this.logService.queueLog(logEntry);
        throw error;
      }),
    );
  }

  private redactSensitive(obj: any): any {
    if (!obj) return obj;
    const sensitiveFields = ['password', 'token', 'authorization', 'secret'];
    const cloned = { ...obj };

    for (const field of sensitiveFields) {
      if (field in cloned) {
        cloned[field] = '[REDACTED]';
      }
    }

    return cloned;
  }
}
```

---

### **5. Admin Log Controller**

**File:** `apps/vlass-api/src/app/controllers/admin-logs.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../guards/authenticated.guard';
import { RbacGuard } from '../guards/rbac.guard';
import { RequireRole } from '../decorators/require-role.decorator';
import { LogRepository } from '../repositories/log.repository';

@Controller('admin/logs')
@UseGuards(AuthenticatedGuard, RbacGuard)
@RequireRole('admin')
export class AdminLogsController {
  constructor(private logRepository: LogRepository) {}

  @Get()
  async getLogs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('type') type?: string,
    @Query('severity') severity?: string,
    @Query('user_id') user_id?: string,
    @Query('status_code') status_code?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 50, 100); // Max 100

    if (pageNum < 1) throw new BadRequestException('Page must be >= 1');

    const { data, total } = await this.logRepository.findPaginated(
      pageNum,
      limitNum,
      {
        type,
        severity,
        user_id,
        status_code: status_code ? parseInt(status_code, 10) : undefined,
        search,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      },
    );

    const summary = await this.logRepository.getSummary(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );

    return {
      data,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
      summary,
    };
  }

  @Get('summary')
  async getSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.logRepository.getSummary(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Post('cleanup')
  async cleanup(@Query('retention_days') retention_days: string = '90') {
    const days = parseInt(retention_days, 10) || 90;

    if (days < 1) {
      throw new BadRequestException('Retention days must be >= 1');
    }

    const deleted = await this.logRepository.deleteOlderThan(days);

    return {
      deleted_count: deleted,
      message: `Deleted ${deleted} logs older than ${days} days`,
    };
  }
}
```

---

## Frontend Implementation

### **1. HTTP Interceptor (Angular)**

**File:** `apps/vlass-web/src/app/interceptors/logging.interceptor.ts`

```typescript
import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpResponse,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, finalize, catchError, of } from 'rxjs';
import { LoggerService } from '../services/logger.service';

@Injectable()
export class LoggingInterceptor implements HttpInterceptor {
  constructor(private loggerService: LoggerService) {}

  intercept(
    request: HttpRequest<any>,
    next: HttpHandler,
  ): Observable<HttpEvent<any>> {
    const startTime = Date.now();
    const { method, url, body } = request;

    return next.handle(request).pipe(
      finalize(() => {
        const duration = Date.now() - startTime;
        // Log after response/error
      }),
      catchError((error: HttpErrorResponse) => {
        const duration = Date.now() - startTime;

        this.loggerService.queueLog({
          type: 'HTTP_REQUEST',
          method,
          url,
          status: error.status,
          statusText: error.statusText,
          duration_ms: duration,
          timestamp: new Date().toISOString(),
          error_message: error.message,
        });

        return of(error);
      }),
    );
  }
}
```

---

### **2. Logger Service (Frontend)**

**File:** `apps/vlass-web/src/app/services/logger.service.ts`

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval } from 'rxjs';

interface LogEntry {
  type: string;
  method?: string;
  url?: string;
  status?: number;
  duration_ms?: number;
  timestamp: string;
  error_message?: string;
  event_name?: string;
}

@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  private logQueue: LogEntry[] = [];
  private flushInterval = 10000; // 10 seconds

  constructor(private http: HttpClient) {
    // Auto-flush every 10 seconds
    interval(this.flushInterval).subscribe(() => this.flushLogs());

    // Flush on page unload
    window.addEventListener('beforeunload', () => this.flushLogs());
  }

  /**
   * Queue a log entry
   */
  queueLog(entry: LogEntry): void {
    entry.timestamp = entry.timestamp || new Date().toISOString();
    this.logQueue.push(entry);

    // Flush if queue is large
    if (this.logQueue.length >= 50) {
      this.flushLogs();
    }
  }

  /**
   * Flush queued logs to backend
   */
  private flushLogs(): void {
    if (this.logQueue.length === 0) return;

    const batch = [...this.logQueue];
    this.logQueue = [];

    this.http
      .post(
        'http://localhost:3000/api/logs/batch',
        { entries: batch },
        { headers: { 'X-Client-Logs': 'true' } },
      )
      .subscribe({
        error: (err) => {
          console.error('Log flush failed:', err);
          // Re-queue on failure
          this.logQueue.unshift(...batch);
        },
      });
  }

  /**
   * Log a custom event
   */
  logEvent(eventName: string, details?: any): void {
    this.queueLog({
      type: 'EVENT',
      event_name: eventName,
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

## Admin Dashboard UI

### **Component Structure**

```text
admin-logs-dashboard/
├── admin-logs-dashboard.component.ts
├── admin-logs-dashboard.component.html
├── admin-logs-dashboard.component.scss
├── log-count-tiles/
│   ├── log-count-tiles.component.ts
│   ├── log-count-tiles.component.html
│   └── log-count-tiles.component.scss
└── log-table/
    ├── log-table.component.ts
    ├── log-table.component.html
    └── log-table.component.scss
```

---

### **Main Dashboard Template**

**File:** `apps/vlass-web/src/app/features/admin/logs/admin-logs-dashboard.component.html`

```html
<div class="logs-dashboard">
  <!-- Header -->
  <mat-toolbar color="primary" class="toolbar">
    <span>System Logs</span>
    <span class="spacer"></span>
    <button mat-icon-button (click)="refreshData()">
      <mat-icon>refresh</mat-icon>
    </button>
  </mat-toolbar>

  <!-- Count Tiles -->
  <section class="tiles-section">
    <app-log-count-tiles
      [counts]="logCounts"
      [selectedFilter]="selectedFilter | async"
      (filterChange)="onFilterChange($event)"
    ></app-log-count-tiles>
  </section>

  <!-- Search & Filters -->
  <section class="filters-section">
    <mat-card>
      <mat-card-content>
        <form [formGroup]="filterForm">
          <div class="filter-row">
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Search</mat-label>
              <input
                matInput
                formControlName="search"
                placeholder="Path, email, or error..."
              />
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Type</mat-label>
              <mat-select formControlName="type">
                <mat-option value="">All</mat-option>
                <mat-option value="HTTP_REQUEST">HTTP</mat-option>
                <mat-option value="EVENT">Event</mat-option>
                <mat-option value="WEBSOCKET">WebSocket</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Severity</mat-label>
              <mat-select formControlName="severity">
                <mat-option value="">All</mat-option>
                <mat-option value="INFO">Info</mat-option>
                <mat-option value="WARNING">Warning</mat-option>
                <mat-option value="ERROR">Error</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>User</mat-label>
              <input matInput formControlName="user_id" placeholder="User ID" />
            </mat-form-field>

            <button
              mat-raised-button
              color="primary"
              (click)="applyFilters()"
              class="apply-btn"
            >
              Apply
            </button>
          </div>

          <div class="filter-row">
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>From</mat-label>
              <input
                matInput
                type="date"
                formControlName="from"
              />
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>To</mat-label>
              <input
                matInput
                type="date"
                formControlName="to"
              />
            </mat-form-field>

            <button
              mat-stroked-button
              (click)="resetFilters()"
              class="reset-btn"
            >
              Reset
            </button>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  </section>

  <!-- Results Table -->
  <section class="table-section">
    <app-log-table
      [logs]="(logs$ | async) || []"
      [loading]="loading$ | async"
      [pagination]="(pagination$ | async) || { page: 1, limit: 50, total: 0 }"
      (pageChange)="onPageChange($event)"
    ></app-log-table>
  </section>
</div>
```

---

### **Count Tiles Component**

```html
<!-- log-count-tiles.component.html -->
<div class="tiles-container">
  <mat-card
    class="tile"
    [class.selected]="selectedFilter === 'all'"
    (click)="selectFilter('all')"
  >
    <span class="count">{{ counts.all }}</span>
    <span class="label">All Logs</span>
  </mat-card>

  <mat-card
    class="tile"
    [class.selected]="selectedFilter === 'http'"
    (click)="selectFilter('http')"
  >
    <mat-icon>http</mat-icon>
    <span class="count">{{ counts.http }}</span>
    <span class="label">HTTP</span>
  </mat-card>

  <mat-card
    class="tile"
    [class.selected]="selectedFilter === 'event'"
    (click)="selectFilter('event')"
  >
    <mat-icon>event</mat-icon>
    <span class="count">{{ counts.event }}</span>
    <span class="label">Events</span>
  </mat-card>

  <mat-card
    class="tile"
    [class.selected]="selectedFilter === 'error'"
    (click)="selectFilter('error')"
  >
    <mat-icon>error</mat-icon>
    <span class="count" class="error">{{ counts.error }}</span>
    <span class="label">Errors</span>
  </mat-card>

  <mat-card
    class="tile"
    [class.selected]="selectedFilter === 'warning'"
    (click)="selectFilter('warning')"
  >
    <mat-icon>warning</mat-icon>
    <span class="count" class="warning">{{ counts.warning }}</span>
    <span class="label">Warnings</span>
  </mat-card>
</div>
```

---

### **Log Table Component** (Material DataTable)

```html
<!-- log-table.component.html -->
<div class="table-wrapper">
  @if (loading) {
    <mat-progress-bar mode="indeterminate"></mat-progress-bar>
  }

  <table mat-table [dataSource]="logs" class="logs-table">
    <!-- Type Column -->
    <ng-container matColumnDef="type">
      <th mat-header-cell>Type</th>
      <td mat-cell>
        <span class="badge" [class]="log.type | lowercase">
          {{ log.type }}
        </span>
      </td>
    </ng-container>

    <!-- Severity Column -->
    <ng-container matColumnDef="severity">
      <th mat-header-cell>Severity</th>
      <td mat-cell>
        <span class="badge" [class]="(log.severity || 'info') | lowercase">
          {{ log.severity || 'INFO' }}
        </span>
      </td>
    </ng-container>

    <!-- Method/Event Column -->
    <ng-container matColumnDef="method">
      <th mat-header-cell>Method / Event</th>
      <td mat-cell>
        {{ log.method || log.event_name || '-' }}
      </td>
    </ng-container>

    <!-- Path/Endpoint Column -->
    <ng-container matColumnDef="path">
      <th mat-header-cell>Path</th>
      <td mat-cell class="monospace">
        {{ log.path || '-' }}
      </td>
    </ng-container>

    <!-- Status Column -->
    <ng-container matColumnDef="status">
      <th mat-header-cell>Status</th>
      <td mat-cell>
        @if (log.status_code) {
          <span [class.error]="log.status_code >= 400">
            {{ log.status_code }}
          </span>
        } @else {
          <span>-</span>
        }
      </td>
    </ng-container>

    <!-- User Column -->
    <ng-container matColumnDef="user">
      <th mat-header-cell>User</th>
      <td mat-cell>
        {{ log.user_email || log.user_id || '-' }}
      </td>
    </ng-container>

    <!-- Duration Column -->
    <ng-container matColumnDef="duration">
      <th mat-header-cell>Duration</th>
      <td mat-cell>
        @if (log.duration_ms) {
          {{ log.duration_ms }}ms
        } @else {
          -
        }
      </td>
    </ng-container>

    <!-- Time Column -->
    <ng-container matColumnDef="time">
      <th mat-header-cell>Time</th>
      <td mat-cell class="time">
        {{ log.created_at | date: 'short' }}
      </td>
    </ng-container>

    <!-- Action Column -->
    <ng-container matColumnDef="actions">
      <th mat-header-cell>Actions</th>
      <td mat-cell>
        <button mat-icon-button [matMenuTriggerFor]="menu">
          <mat-icon>more_vert</mat-icon>
        </button>
        <mat-menu #menu="matMenu">
          <button mat-menu-item (click)="viewDetails(log)">
            <mat-icon>visibility</mat-icon>
            <span>Details</span>
          </button>
          <button mat-menu-item (click)="copyToClipboard(log)">
            <mat-icon>content_copy</mat-icon>
            <span>Copy JSON</span>
          </button>
        </mat-menu>
      </td>
    </ng-container>

    <tr mat-header-row></tr>
    <tr mat-row></tr>
  </table>

  <!-- Pagination -->
  <mat-paginator
    [length]="pagination.total"
    [pageSize]="pagination.limit"
    [pageSizeOptions]="[10, 25, 50, 100]"
    (page)="onPageChange($event)"
  ></mat-paginator>
</div>
```

---

## RBAC & Security

### **Required Roles**

```typescript
interface Role {
  name: 'admin' | 'moderator' | 'user';
  permissions: string[];
}

const rolePermissions = {
  admin: [
    'admin:read_logs',      // View all logs
    'admin:filter_logs',    // Use filters
    'admin:delete_logs',    // Delete old logs
    'admin:export_logs',    // Export to CSV (future)
  ],
  moderator: [
    'admin:read_logs',      // View logs
    'admin:filter_logs',
  ],
  user: [
    // No log access
  ],
};
```

### **RBAC Guard**

```typescript
// Protect admin endpoints
@UseGuards(AuthenticatedGuard, RbacGuard)
@RequireRole('admin')
@Controller('admin/logs')
export class AdminLogsController { ... }
```

---

## Implementation Timeline

### Phase 1: Core Logging (3 days)

- [ ] Create Log entity + repository
- [ ] Create LogService with Redis/DB write
- [ ] Create HTTP interceptor (backend)
- [ ] Create HTTP interceptor (frontend)
- [ ] Add batch log endpoint
- [ ] Unit tests for logging

### Phase 2: Admin Endpoints (2 days)

- [ ] Create AdminLogsController
- [ ] Implement GET /api/admin/logs with filters
- [ ] Implement GET /api/admin/logs/summary
- [ ] Implement cleanup endpoint
- [ ] Integration tests

### Phase 3: Frontend Dashboard (2 days)

- [ ] Create admin-logs-dashboard component
- [ ] Create log-count-tiles component
- [ ] Create log-table component with Material DataTable
- [ ] Implement search/filter form
- [ ] Add RBAC guards to routing

### Phase 4: Polish & Testing (1 day)

- [ ] E2E tests for logging flow
- [ ] Performance optimization (Redis queries)
- [ ] Documentation
- [ ] UAT with admins

### Total: ~1 week for MVP

---

## Configuration

### **Environment Variables**

```bash
# .env
REDIS_URL=redis://localhost:6379
LOG_RETENTION_DAYS=90
LOG_BATCH_SIZE=100
LOG_FLUSH_INTERVAL_MS=5000
LOG_SENSITIVE_FIELDS=password,token,authorization,secret
```

---

## Success Metrics

- ✅ All HTTP/WebSocket/event traffic logged
- ✅ Admin can see logs within 5 seconds of action
- ✅ Filters work smoothly (< 500ms query time)
- ✅ 90-day retention without performance degradation
- ✅ RBAC prevents unauthorized access
- ✅ Redis + DB stay in sync

---

## Future Enhancements (v2+)

- [ ] WebSocket log collection
- [ ] Real-time log streaming to admin dashboard
- [ ] Custom alerts for error rates
- [ ] Log export to CSV/JSON
- [ ] Integration with external logging services (DataDog, ELK)
- [ ] Machine learning anomaly detection

---

**Ready to implement?** Start with Phase 1 (core logging infrastructure).
