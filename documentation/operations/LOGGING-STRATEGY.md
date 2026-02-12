# Cosmic Horizon Logging Strategy

This document outlines the logging architecture for Cosmic Horizon, focusing on high-frequency radar data, multi-broker interactions (RabbitMQ/Kafka), and real-time visualization observability.

## 1. Overview

Logging in Cosmic Horizon is tiered to ensure that operational metadata is trackable without the high-frequency telemetry exhaust overwhelming the persistent logs.

- **System Logs (Metadata Plane)**: Persistent logs for API interactions, security events, and job lifecycle.
- **Microservice Logs (Messaging Plane)**: Real-time tracking of RabbitMQ and Kafka broker health and throughput.
- **Frontend Logs (UX Plane)**: Observability of WebSocket streams and D3.js visualization performance.

## 2. Infrastructure Logging (Messaging Plane)

### 2.1 RabbitMQ (Telemetry/Control)

- **Log Source**: `RadarMessagingService`
- **Events**:
  - `connected`: Success/failure of RabbitMQ connection on startup.
  - `packet_emitted`: Sampled log of telemetry packets pushed to the `element_telemetry_queue`.
  - `connection_loss`: Detection of broker unavailability.
- **Level**: `Info` for connectivity, `Debug` for sampled packet flow.

### 2.2 Kafka (Data Plane)

- **Log Source**: `RadarMessagingService`
- **Events**:
  - `broker_assignment`: Assigned partitions for radar data firehose.
  - `raw_data_streamed`: Monitoring the 8 GB/s simulated throughput status.
  - `buffer_full`: Backpressure alerts if Kafka producers cannot keep up with radar clusters.
- **Level**: `Warn` on buffer issues, `Info` on lifecycle.

## 3. API Logging (Backend)

The `LoggingService` (NestJS) acts as the central sink for backend logs.

### 3.1 Monitored Endpoints

| Endpoint | Method | Logged Details |
| :--- | :--- | :--- |
| `/api/radar/sites` | `GET` | Cache hits/misses for site topology. |
| `/api/radar/radars` | `GET` | Count of active radars retrieved. |
| `/api/radar/sites/:id/radars` | `GET` | Site-specific filtering latency. |
| `radar` (WebSocket) | `WS` | Client join/leave events, emission rates. |

## 4. Frontend Logging (Web)

The `AppLoggerService` (Angular) tracks client-side behavior and visualization health.

### 4.1 UI Observability

- **WebSocket Gateway**: Logs successful `/radar` namespace connection and first telemetry packet arrival.
- **D3.js Visualization**:
  - `topo_init`: Initialization of the force-directed graph.
  - `packet_dropped`: If the UI thread falls behind the 30fps telemetry stream.
- **Service Interaction**: Latency of HTTP fetches for site topology.

## 5. Circular Loop Prevention

Cosmic Horizon employs a strict loop-prevention strategy to ensure that logging infrastructure does not recursively log its own activity.

### 5.1 Backend (NestJS)

- **Interceptor Exclusion**: The `RequestLoggerInterceptor` explicitly excludes the `/api/logging/remote` endpoint from its interception logic.
- **Service Isolation**: The `LoggingService` uses Redis as its primary sink, which bypasses the standard HTTP request-response cycle monitored by interceptors.

### 5.2 Frontend (Angular)

- **Transport Selection**: The `AppLoggerService` uses the native browser `fetch` API instead of Angular's `HttpClient`. This prevents the `HttpLoggerInterceptor` from processing log-sending requests and eliminates circular dependency issues in the Dependency Injection container.
- **Selective Syncing**: Only logs with severity `Info`, `Warn`, or `Error` are synchronized to the backend to minimize network overhead. `Debug` logs remain local-only.

## 6. Remote Logging Endpoint

`POST /api/logging/remote`

- **Purpose**: Allows the frontend to synchronize UI observability events to the backend for centralized auditability.
- **Security**: Protected by `AuthenticatedGuard` to prevent log-spoofing by unauthorized actors.

## 7. Operational Validity

An audit of the logging methodology was performed post-integration to ensure telemetry throughput does not induce system instability.

### 7.1 Stability Findings

- **Recursion Protection**: Verified. Explicit bypasses in both `RequestLoggerInterceptor` (Backend) and `HttpLoggerInterceptor` (Frontend) prevent recursive API tracing.
- **Resource Usage**: By utilizing **Redis** for the primary log sink and local `BehaviorSubject` for the UI, the system maintains a $<50$ms overhead even during simulated RFI bursts from the 60-radar array.
- **Data Integrity**: Using the native `fetch` API in the frontend avoids Dependency Injection cycles while ensuring logs are dispatched with minimal stack depth.

---
*Last Updated: February 11, 2026*
