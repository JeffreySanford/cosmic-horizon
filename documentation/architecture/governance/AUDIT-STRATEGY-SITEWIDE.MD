# Site-Wide Audit Strategy

**Last Updated:** February 12, 2026  
**Status:** Active  
**Audience:** Platform Architects, Site Reliability Engineers, Compliance Officers

---

## Table of Contents

1. Overview
2. Audit Architecture
3. Data Classification and Retention
4. Audit Event Types
5. Compliance and Standards
6. Logging Infrastructure
7. Security and Privacy
8. Monitoring and Alerting
9. Access Control and Permissions
10. Incident Response
11. Implementation Roadmap

---

## Overview

The Cosmic Horizons platform requires comprehensive audit coverage to support:

- **Regulatory Compliance**: Federal data handling requirements
- **Scientific Accountability**: Reproducible workflows and parameter tracking
- **Security Incident Response**: Full forensic capabilities
- **Operational Visibility**: Performance metrics and system health
- **User Action Traceability**: Who did what, when, and where

This strategy establishes a multi-layered audit infrastructure that captures events across all platform tiers while maintaining performance, security, and usability.

---

## Audit Architecture

### 1. **Multi-Layer Event Capture**

````text
┌─────────────────────────────────────────────────────┐
│  USER ACTIONS (UI)                                  │
│  - Searches, filters, exports                       │
│  - Job submissions, cancellations                   │
│  - Configuration changes                           │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  API LAYER                                          │
│  - Request/response logging                        │
│  - Authentication & authorization decisions        │
│  - API rate limiting & quota enforcement           │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  SERVICE LAYER                                      │
│  - Job submission & orchestration                  │
│  - Calibration operations                          │
│  - Data processing workflows                       │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  PERSISTENCE LAYER                                  │
│  - Job lifecycle tracking (QUEUED→COMPLETED)       │
│  - Performance metrics collection                  │
│  - Error logs & retry tracking                     │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  EXTERNAL SYSTEMS                                   │
│  - TACC/HPC job tracking                           │
│  - Remote execution logs                           │
│  - Data staging & archival events                  │
└─────────────────────────────────────────────────────┘
```text

### 2. **Audit Trail Components**

#### A. **Job Audit Trail**

Every computational job generates an immutable lifecycle record:

```typescript
interface JobAuditEntry {
  // Identification
  job_id: string;                    // Local job UUID
  tacc_job_id: string;              // Remote execution ID
  dataset_id: string;                // Input data reference
  user_id: string;                  // Submitting user

  // Agent & Configuration
  agent: 'AlphaCal' | 'ImageReconstruction' | 'AnomalyDetection';
  rfi_strategy: 'low' | 'medium' | 'high' | 'high_sensitivity';
  params: Record<string, any>;       // Full parameter snapshot

  // Lifecycle Events
  status_history: Array<{
    status: 'QUEUED' | 'QUEUING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    timestamp: Date;
    context?: string;                // Error messages, retry info
  }>;

  // Performance Metrics
  metrics: {
    execution_time_seconds: number;
    gpu_utilization_percent: number;
    memory_used_gb: number;
    data_volume_processed_gb: number;
    gflops_achieved: number;
  };

  // Timestamps
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;

  // Traceability
  retry_count: number;               // Retry attempts
  notes: string;                    // Error context, recovery actions
}
```text

#### B. **User Action Audit**

Track all user interactions with the system:

```typescript
interface UserActionAudit {
  // Action identification
  action_id: string;                // Unique action UUID
  timestamp: Date;
  user_id: string;

  // Action details
  action_type: 'SEARCH' | 'FILTER' | 'EXPORT' | 'SUBMIT_JOB' |
               'CANCEL_JOB' | 'VIEW_RESULTS' | 'CONFIG_CHANGE' |
               'ROLE_ASSIGNMENT' | 'ACCESS_GRANT' | 'ACCESS_REVOKE';

  resource_id?: string;               // Job, dataset, user, etc.
  resource_type?: 'Job' | 'Dataset' | 'User' | 'Config';

  // Event details
  http_method: string;               // GET, POST, DELETE, etc.
  endpoint: string;                  // /api/jobs, /api/search, etc.
  status_code: number;              // HTTP response code

  // Parameters & Results
  query_params?: Record<string, any>;
  request_body_hash?: string;        // SHA256 of request payload
  response_summary?: Record<string, any>;

  // Security context
  client_ip: string;
  user_agent: string;
}
```text

#### C. **Security Event Audit**

Track authentication, authorization, and security-related events:

```typescript
interface SecurityEventAudit {
  // Event identification
  event_id: string;
  timestamp: Date;

  // Authentication events
  auth_event?: {
    event: 'LOGIN' | 'LOGOUT' | 'TOKEN_REFRESH' | 'LOGIN_FAILED' |
           'MFA_CHALLENGE' | 'SESSION_EXPIRED';
    user_id?: string;
    login_method: 'PASSWORD' | 'OAUTH' | 'GITHUB' | 'SAML';
    success: boolean;
    ip_address: string;
  };

  // Authorization events
  authz_event?: {
    user_id: string;
    action: 'ALLOW' | 'DENY' | 'CHALLENGE';
    required_role: string;
    user_role: string;
    resource_id: string;
    resource_type: string;
  };

  // Anomaly detection
  anomaly_detected: boolean;
  anomaly_type?: 'BRUTE_FORCE' | 'UNUSUAL_ACCESS_TIME' |
                'UNUSUAL_LOCATION' | 'ELEVATED_PRIVILEGES' |
                'DATA_EXFILTRATION_ATTEMPT';

  // Risk score
  risk_score: number;                // 0-100
  action_taken: 'LOG' | 'ALERT' | 'BLOCK' | 'MFA_CHALLENGE';
}
```text

#### D. **Data Access & Export Audit**

Track all data access and export events for compliance:

```typescript
interface DataAccessAudit {
  // Access identification
  access_id: string;
  timestamp: Date;
  user_id: string;

  // Data accessed
  dataset_ids: string[];             // Which datasets accessed
  data_classification: 'PUBLIC' | 'INTERNAL' | 'RESTRICTED' | 'CONFIDENTIAL';

  // Access type
  access_type: 'VIEW' | 'DOWNLOAD' | 'EXPORT' | 'QUERY' | 'API_ACCESS';
  export_format?: 'FITS' | 'CSV' | 'JSON' | 'HDF5' | 'PARQUET';

  // Data volume
  total_rows_accessed?: number;
  total_bytes_accessed: number;

  // Destination (for exports)
  export_destination?: 'LOCAL_EXPORT' | 'CLOUD_STORAGE' | 'EXTERNAL_API';

  // Justification & approvals
  use_case: string;                  // "Research", "Collaboration", etc.
  approval_required: boolean;
  approved_by?: string;
  approval_timestamp?: Date;
}
```text

---

## Data Classification & Retention

### Classification Levels

| Level | Type | Examples | Retention |
|-------|------|----------|-----------|
| PUBLIC | Non-sensitive | Published results, documentation | Permanent |
| INTERNAL | Team-level | Configuration, performance logs | 365 days |
| RESTRICTED | High-sensitivity | User credentials, API keys | 30 days |
| CONFIDENTIAL | PII/PHI | User details, research in progress | As required by regulation |

### Retention Policy

```text
Public Data:         Permanent in archive
Internal Audit:      3 years (365 days hot, 2 years cold)
Security Events:     1 year (90 days hot, 270 days warm)
User Actions:        1 year (rolling window)
Performance Metrics: 90 days hot, 2 years aggregate
Export Records:      7 years (regulatory requirement)
```text

---

## Audit Event Types

### 1. **User Session Events**

- User login/logout
- Session creation/termination
- Token refresh and validation
- MFA challenges and completions
- Session timeout/expiry
- Permission changes during session

### 2. **Job Management Events**

- Job submission with full parameter snapshot
- Job status transitions with reasons
- Job cancellation and reason
- Job retry attempts
- Job completion with results summary
- Job archival
- Job export/sharing

### 3. **Data Access Events**

- Data search and filter operations
- Data visualization interactions
- Data export requests and approvals
- API key generation and revocation
- Rate limit violations
- Quota exceeded events

### 4. **System Configuration Events**

- Algorithm parameter changes
- System resource allocation changes
- Service deployments
- Configuration backup/restore
- Secret rotation events
- Access policy changes

### 5. **Security Events**

- Failed authentication attempts
- Unauthorized access attempts
- Role/permission assignments
- Security policy violations
- Encryption key management
- Certificate expiration warnings

### 6. **Performance & Monitoring**

- Job execution metrics
- API response times
- Error rates and types
- Resource utilization
- Cache performance
- Database query performance

---

## Compliance & Standards

### Regulatory Frameworks

| Framework | Requirement | Implementation |
|-----------|-------------|-----------------|
| **FISMA** | Federal information security | Audit logging, access controls, encryption |
| **NIST SP 800-53** | Security controls | Event logging, incident response procedures |
| **OMB A-130** | Information security policy | Data classification, retention policies |
| **FIPS 140-2** | Cryptographic standards | HTTPS, encrypted storage, key management |
| **NSF Guidelines** | NSF data management | Provenance tracking, reusability, attribution |

### Audit Requirements

- **Immutability**: Audit records cannot be modified or deleted
- **Completeness**: All security-relevant events captured
- **Timeliness**: Events logged in real-time or near-real-time
- **Accountability**: User actions traceable to individuals
- **Integrity**: Audit data protected from tampering
- **Availability**: Audit data backup and recovery capabilities

---

## Logging Infrastructure

### 1. **Structured Logging**

All audit events use structured JSON format:

```json
{
  "event_id": "ae7f42b9-8c1f-4e9a-b3d2-7c5f9a1b2d4e",
  "timestamp": "2026-02-12T14:30:00.000Z",
  "event_type": "JOB_SUBMITTED",
  "severity": "INFO",
  "user_id": "user-uuid-001",
  "resource": {
    "type": "Job",
    "id": "job-uuid-001"
  },
  "action": "SUBMIT",
  "result": "SUCCESS",
  "metadata": {
    "agent": "AlphaCal",
    "dataset_id": "dataset-uuid-001",
    "rfi_strategy": "medium",
    "gpu_count": 2
  }
}
```text

### 2. **Multi-Destination Logging**

Events sent to multiple systems for redundancy:

```text
┌─────────────────────────┐
│  Application Logging    │
│  (Winston/NestJS)       │
└────────┬────────────────┘
         │
    ┌────┴────────────────────────────────┐
    │                                       │
    ▼                                       ▼
┌──────────────────┐            ┌──────────────────────┐
│  PostgreSQL      │            │  Elasticsearch Stack │
│  Audit Tables    │            │  (Long-term index)   │
└──────────────────┘            └──────────────────────┘
    │                                    │
    ├─────────────┬──────────────────────┤
    │             │                      │
    ▼             ▼                      ▼
┌─────────┐  ┌──────────┐          ┌─────────────┐
│ Redis   │  │ S3 Archiv│          │ TACC Logs   │
│ Cache   │  │ (Cold)   │          │ (External)  │
└─────────┘  └──────────┘          └─────────────┘
```text

### 3. **Log Aggregation**

```text
Event Source → Log Shipper → Message Queue → Log Processor → Storage
   ↓                                                            ↓
- API Requests          Fluent/Logstash      RabbitMQ      PostgreSQL
- Database Changes      FileBeats            Kafka         Elasticsearch
- System Events         AWS CloudWatch                      S3
- External Systems
```text

---

## Security & Privacy

### 1. **Sensitive Data Protection**

**Never Logged:**

- User passwords (ever)
- API keys or secrets (except as hashed references)
- Credit card/payment information
- Personal health information (PHI)
- Unencrypted PII

**Logged with Protection:**

- User email (hash or partial masking after retention period)
- Request bodies (if needed, store hash + sampling)
- API responses (summary only, not full payload)

### 2. **Encryption**

```text
In Transit:  TLS 1.3 for all log transport
At Rest:     AES-256-GCM for encrypted storage
Transit:     Encrypted channels (HTTPS, AMQPS)
Archival:    S3 Server-Side Encryption
Keys:        AWS KMS or HashiCorp Vault
```text

### 3. **Access Control Model**

```text
Audit Data Access Levels:
├── Level 1: Own Actions Only
│   └─ Users can search their own job history
├── Level 2: Team Access
│   └─ Team leads see team member actions
├── Level 3: Administrative Access
│   └─ Admins see organization-wide audit
└── Level 4: Compliance Officer Access
    └─ SoC compliance, regulatory audits
```text

---

## Monitoring & Alerting

### 1. **Real-Time Alerts**

```text
Event Type                        Threshold     Action
─────────────────────────────────────────────────────────
Failed Login Attempts             5 in 15 min   INVESTIGATE
Unusual Permission Grant          Any           ALERT
Data Export > 10GB                Any           APPROVAL
API Error Rate                    > 5%          INCIDENT
Job Failure Rate                  > 25%         WARNING
Unauthorized API Access           Any           BLOCK
Missing Audit Records             > 1 hour      ALERT
```text

### 2. **Audit Dashboard**

```text
Real-Time Metrics:
├─ Active User Sessions
├─ Jobs Submitted (last hour)
├─ API Request Volume
├─ Failed Authentication Attempts
├─ Data Exports in Progress
├─ System Error Rate
└─ Log Ingestion Rate

Compliance Status:
├─ Audit Data Completeness (%)
├─ Log Retention Adherence
├─ Encryption Coverage (%)
└─ Access Control Violations
```text

### 3. **Alerting Rules**

```yaml
rules:
  - name: BruteForceDetection
    condition: |
      SELECT COUNT(*) as attempts
      FROM security_events
      WHERE event = 'LOGIN_FAILED'
        AND created_at > NOW() - INTERVAL '15 minutes'
      GROUP BY user_id
      HAVING COUNT(*) > 5
    alert: CRITICAL

  - name: UnusualDataAccess
    condition: |
      SELECT * FROM data_access_audit
      WHERE bytes_accessed > 100GB
        AND timestamp > NOW() - INTERVAL '1 hour'
    alert: HIGH

  - name: AuditLogGaps
    condition: |
      SELECT COUNT(*) FROM audit_logs
      WHERE created_at < NOW() - INTERVAL '3 hours'
    alert: CRITICAL
```text

---

## Access Control & Permissions

### 1. **Audit Data Permissions**

| Role | Own Actions | Team Actions | System Audit | Admin | Compliance |
|------|------------|--------------|--------------|-------|-----------|
| User | ✓ | | | | |
| Team Lead | ✓ | ✓ | | | |
| Admin | ✓ | ✓ | ✓ | ✓ | |
| Compliance Officer | | | ✓ | ✓ | ✓ |

### 2. **Audit Export Restrictions**

- Compliance exports: Require signature/approval
- Data exports: Logged and retained for 7 years
- Deletion requests: Supported for personal data only
- Right to be forgotten: GDPR-compliant process

---

## Incident Response

### 1. **Incident Timeline Reconstruction**

```text
User reports suspicious activity
         ↓
Query Job Audit Trail (tacc_job_id → parameters → results)
         ↓
Query User Action Audit (search → filter → export → analysis)
         ↓
Query Security Event Audit (login → permission → access)
         ↓
Query Data Access Audit (export destination → timestamp)
         ↓
Timeline established → Forensic analysis begins
```text

### 2. **Common Incident Queries**

```sql
-- "Find all jobs submitted by user in last 7 days"
SELECT * FROM job_audit_trail
WHERE user_id = ?
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- "Trace data export destination"
SELECT * FROM data_access_audit
WHERE export_destination = 'EXTERNAL_API'
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- "Find failed authentication attempts by user"
SELECT * FROM security_event_audit
WHERE auth_event->>'event' = 'LOGIN_FAILED'
  AND user_id = ?
ORDER BY timestamp DESC LIMIT 20;
```text

---

## Implementation Roadmap

### Phase 1: Foundation (Months 1-2)

- ✅ Job Audit Trail implementation
- ✅ Error handling & retry tracking
- ✅ Performance metrics capture
- PostgreSQL audit tables schema
- Structured logging framework

### Phase 2: User & Security (Months 2-3)

- User action audit logging
- Security event auditing
- Authentication/authorization event capture
- Real-time alert framework

### Phase 3: Compliance & Retention (Months 3-4)

- Data classification enforcement
- Retention policy automation
- Encryption at rest implementation
- Audit log archival to S3

### Phase 4: Monitoring & Analytics (Months 4-5)

- Audit dashboard development
- Real-time alerting system
- Forensic analysis tools
- Compliance reporting

### Phase 5: Integration & Hardening (Months 5-6)

- External system integration (TACC, cloud providers)
- Audit log immutability enforcement
- Security testing & penetration testing
- Documentation & runbooks

---

## Configuration Examples

### Environment Variables

```bash
# Audit Configuration
AUDIT_ENABLED=true
AUDIT_LOG_LEVEL=INFO
AUDIT_EVENT_TTL_DAYS=365

# Storage
AUDIT_POSTGRES_ENABLED=true
AUDIT_ELASTICSEARCH_ENABLED=false
AUDIT_S3_ARCHIVAL_ENABLED=true
AUDIT_S3_BUCKET_NAME=cosmic-horizons-audit-archive

# Retention
AUDIT_HOT_RETENTION_DAYS=90
AUDIT_WARM_RETENTION_DAYS=270
AUDIT_COLD_RETENTION_YEARS=3

# Encryption
AUDIT_ENCRYPTION_ENABLED=true
AUDIT_ENCRYPTION_KEY_PROVIDER=aws-kms
AUDIT_ENCRYPTION_ALGORITHM=AES-256-GCM

# Alerts
ALERT_FAILED_AUTH_THRESHOLD=5
ALERT_FAILED_AUTH_WINDOW_MINUTES=15
ALERT_BRUTE_FORCE_BLOCK_ENABLED=true
```text

### SQL Schema

```sql
CREATE TABLE job_audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id),
    tacc_job_id VARCHAR(255),
    user_id UUID NOT NULL REFERENCES users(id),
    agent VARCHAR(50),
    rfi_strategy VARCHAR(20),
    params JSONB,
    status_history JSONB,
    metrics JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    notes TEXT,

    INDEX idx_user_created (user_id, created_at),
    INDEX idx_job_id (job_id),
    INDEX idx_created_at (created_at)
);

CREATE TABLE user_action_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    action_type VARCHAR(50),
    resource_type VARCHAR(50),
    resource_id UUID,
    http_method VARCHAR(10),
    endpoint VARCHAR(255),
    status_code INTEGER,
    query_params JSONB,
    request_body_hash VARCHAR(64),
    client_ip INET,
    user_agent TEXT,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user_timestamp (user_id, timestamp),
    INDEX idx_timestamp (timestamp)
);
```text

---

## Summary

The Cosmic Horizons audit strategy provides comprehensive event capture across all platform layers while maintaining security, performance, and regulatory compliance. By implementing this multi-layer approach:

- **Accountability**: Complete action traceability
- **Security**: Anomaly detection and incident response
- **Compliance**: Regulatory requirement fulfillment
- **Observability**: Operational visibility
- **Auditability**: Forensic capabilities

This foundation enables the platform to scale confidently into production while maintaining the trust and transparency required for scientific computing.
````
