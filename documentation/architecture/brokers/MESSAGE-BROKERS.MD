# Kafka Container

This document describes the Kafka container used within the Cosmic Horizons architecture. Kafka is a distributed event streaming platform that provides high-throughput, fault‑tolerant, and horizontally scalable messaging. The Kafka container is responsible for:

1. **Brokering and Topic Management**
   - Hosting one or more Kafka brokers that manage partitions for topics.
   - Handling producer requests to publish messages and consumer requests to subscribe to topics.
   - Coordinating with ZooKeeper (or with the built‑in KRaft controller in newer versions) to manage metadata, leader election, and cluster configuration.

2. **Persistent Message Storage**
   - Writing records to disk-backed log segments for durability.
   - Retaining data according to configurable retention policies, compacting topics when required.

3. **Replication and Fault Tolerance**
   - Replicating topic partitions across multiple broker instances for high availability.
   - Performing leader election automatically when brokers fail or recover.

4. **Monitoring and Metrics**
   - Exposing JMX metrics for cluster health, throughput, and consumer lag.
   - Integrating with Prometheus or other monitoring systems via exporters.

5. **Security and Access Control**
   - Enabling TLS encryption for client‑broker communication.
   - Securing topics with ACLs and authentication mechanisms (SASL, SCRAM, or OAuth).

In Cosmic Horizons the Kafka container is often used for ingesting telemetry, job status updates, and intermediary event flow between microservices. The container is defined in the `docker-compose.events.yml` file and is scaled horizontally in production to handle high message volumes.

---

# RabbitMQ Container

RabbitMQ is an open-source message broker implementing the AMQP protocol. The RabbitMQ container within the architecture fulfills the following responsibilities:

1. **Message Queuing and Delivery Semantics**
   - Providing queues that store messages until a consuming application retrieves them.
   - Supporting various delivery guarantees: at-most-once, at-least-once, and exactly-once via acknowledgments and durable queues.
   - Enabling routing using exchanges (direct, fanout, topic, headers) to dispatch messages to the appropriate queue(s).

2. **Protocol and Client Support**
   - Handling AMQP 0‑9‑1 by default, with plugins available for MQTT, STOMP, HTTP, and others.
   - Managing client connections, channels, and virtual hosts to isolate applications.

3. **Clustering and High Availability**
   - Forming RabbitMQ clusters with mirrored queues to replicate messages between nodes.
   - Quorum queues for stronger data safety guarantees.

4. **Management and Monitoring**
   - Exposing an HTTP-based management API and UI for monitoring exchanges, queues, and connections.
   - Providing metrics via plugins for Prometheus and other monitoring tools.

5. **Security Features**
   - Supporting TLS for encrypted communication.
   - Configuring user accounts, permissions, and access control policies per virtual host.

In our system, the RabbitMQ container is typically used for workflows requiring complex routing patterns or compatibility with AMQP clients, such as legacy services and asynchronous background tasks. The container is declared alongside the Kafka service in development compose files, allowing developers to switch brokers for experimentation or redundancy.

---

# Pulsar Container

Apache Pulsar is a distributed pub-sub messaging system with a serverless computing framework built in (Pulsar Functions). The Pulsar container in the architecture handles:

1. **Multi-Tenant Messaging and Topics**
   - Serving as the broker for persistent topics and managing subscriptions (exclusive, shared, failover, key_shared).
   - Providing geo‑replication capabilities to mirror data across clusters.

2. **Durable Storage Using BookKeeper**
   - Leveraging Apache BookKeeper for write‑ahead logs that decouple compute (broker) from storage.
   - Maintaining ledger entries on BookKeeper ensembles for fault tolerance.

3. **Streaming and Processing**
   - Running Pulsar Functions for lightweight, real-time stream processing tasks with Python, Java, or Go.
   - Integrating with Apache Flink and other stream processors via connectors.

4. **Schema Registry and Message Validation**
   - Offering a built-in schema registry supporting Avro, JSON, Protobuf, and custom schemas.
   - Enforcing schema compatibility rules to ensure producer/consumer contracts.

5. **Observability and Administration**
   - Exposing REST and administrative APIs for topic management, scaling, and health checks.
   - Emitting metrics for Prometheus and supporting detailed tracing of messages and functions.

6. **Security and Authorization**
   - Implementing TLS, token-based authentication (JWT), and RBAC policies per tenant or namespace.

In the Cosmic Horizons environment Pulsar is used for workloads that benefit from its flexible multi‑tenant architecture and seamless integration between messaging and lightweight compute. The Pulsar container is part of the `docker-compose.astronomy.yml` file for astronomer-specific data pipelines, and it coexists with BookKeeper and ZooKeeper/BookKeeper-proxy containers. Its serverless functions are used for on‑the‑fly transformation of observation data as events flow through the system.

---

Each of these three containers plays a distinct role in the system's event streaming architecture. Kafka is optimized for high-throughput log‑centric streams; RabbitMQ excels at flexible routing and AMQP interoperability; Pulsar offers a rich multi‑tenant, storage‑decoupled platform with built‑in processing. The choice of broker depends on requirements around throughput, latency, tenancy, schema management, and developer ergonomics.