# Data Dictionary

| Table      | Purpose                                    | Retention                   | PII Classification            |
| ---------- | ------------------------------------------ | --------------------------- | ----------------------------- |
| users      | Registered accounts and profile data       | indefinite                  | low (email, display name)     |
| posts      | Community notebook posts                   | indefinite                  | user-generated content        |
| revisions  | Post revision history                      | indefinite                  | user-generated content        |
| comments   | Comments and replies                       | indefinite                  | user-generated content        |
| audit_logs | System audit trail for security/compliance | {AUDIT_RETENTION_DAYS} days | sensitive (user IDs, actions) |
| ...        | ...                                        | ...                         | ...                           |

Add additional rows when new tables are created via migrations.
