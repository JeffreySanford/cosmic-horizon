#!/usr/bin/env node

/**
 * Pulsar Infrastructure Setup & Verification
 * 
 * Performs:
 * 1. Health checks on Pulsar cluster
 * 2. Creates namespaces and topics for CosmicAI workloads
 * 3. Sets up retention policies (mimicking Kafka 30-day retention)
 * 4. Configures backlog quotas for event streams
 * 
 * Usage: node scripts/pulsar-setup.mjs [--cleanup]
 */

import { PulsarClient } from 'pulsar-client';
import axios from 'axios';
import * as fs from 'fs';

const PULSAR_ADMIN_URL = 'http://localhost:8080';
const PULSAR_SERVICE_URL = 'pulsar://localhost:6650';
const PULSAR_WS_URL = 'ws://localhost:8081';

// ============================================================================
// Configuration: Namespaces & Topics
// ============================================================================

const NAMESPACES = [
  {
    namespace: 'public/default',
    description: 'Default namespace (pre-existing)'
  },
  {
    namespace: 'public/cosmic-ai',
    description: 'CosmicAI workloads (job orchestration)',
    properties: {
      'retention_seconds': 2592000, // 30 days
      'replication_clusters': ['local']
    }
  },
  {
    namespace: 'public/observatories',
    description: 'Observatory and telescope data products',
    properties: {
      'retention_seconds': 7776000, // 90 days for science data
      'replication_clusters': ['local']
    }
  },
  {
    namespace: 'public/metrics',
    description: 'System and performance metrics',
    properties: {
      'retention_seconds': 604800, // 7 days for operational metrics
      'replication_clusters': ['local']
    }
  }
];

const TOPICS = [
  {
    namespace: 'public/cosmic-ai',
    topics: [
      {
        name: 'job-submitted',
        description: 'Job submission events (RabbitMQ → Pulsar migration)',
        partitions: 3,
        retention: { retentionSizeInMB: 5120, retentionTimeInMinutes: 43200 } // 5GB, 30 days
      },
      {
        name: 'job-status-changed',
        description: 'Job status transitions (QUEUED → RUNNING → COMPLETED)',
        partitions: 3,
        retention: { retentionSizeInMB: 5120, retentionTimeInMinutes: 43200 }
      },
      {
        name: 'job-completed',
        description: 'Job completion events with results',
        partitions: 2,
        retention: { retentionSizeInMB: 2048, retentionTimeInMinutes: 43200 }
      },
      {
        name: 'calibration-events',
        description: 'AlphaCal calibration progress and results',
        partitions: 4,
        retention: { retentionSizeInMB: 10240, retentionTimeInMinutes: 43200 }
      },
      {
        name: 'image-reconstruction-events',
        description: 'Radio image reconstruction progress',
        partitions: 4,
        retention: { retentionSizeInMB: 10240, retentionTimeInMinutes: 43200 }
      }
    ]
  },
  {
    namespace: 'public/observatories',
    topics: [
      {
        name: 'science-ready-products',
        description: 'Science Ready Data Products (SRDPs) from AI agents',
        partitions: 2,
        retention: { retentionSizeInMB: 51200, retentionTimeInMinutes: 129600 } // 50GB, 90 days
      },
      {
        name: 'observation-metadata',
        description: 'Observation metadata (target, calibration, ephemeris)',
        partitions: 1,
        retention: { retentionSizeInMB: 1024, retentionTimeInMinutes: 129600 }
      }
    ]
  },
  {
    namespace: 'public/metrics',
    topics: [
      {
        name: 'broker-metrics',
        description: 'Pulsar broker performance metrics',
        partitions: 1,
        retention: { retentionSizeInMB: 1024, retentionTimeInMinutes: 10080 } // 1GB, 7 days
      },
      {
        name: 'job-performance-metrics',
        description: 'GPU utilization, execution time, resource metrics',
        partitions: 2,
        retention: { retentionSizeInMB: 2048, retentionTimeInMinutes: 10080 }
      },
      {
        name: 'api-latency-metrics',
        description: 'API request/response latencies',
        partitions: 1,
        retention: { retentionSizeInMB: 512, retentionTimeInMinutes: 10080 }
      }
    ]
  }
];

// ============================================================================
// Utility Functions
// ============================================================================

async function checkClusterHealth() {
  console.log('\n[1] Checking Pulsar cluster health...');
  try {
    const response = await axios.get(`${PULSAR_ADMIN_URL}/admin/v2/clusters`);
    console.log(`✓ Pulsar cluster detected`);
    
    const broker = await axios.get(`${PULSAR_ADMIN_URL}/admin/v2/brokers`);
    console.log(`✓ Active brokers: ${broker.data.join(', ')}`);

    const brokerStats = await axios.get(`${PULSAR_ADMIN_URL}/admin/v2/brokerStats`);
    console.log(`✓ Broker metrics accessible`);

    return true;
  } catch (error) {
    console.error('✗ Cluster health check failed:', error.message);
    console.error('  Ensure Pulsar is running: docker compose -f docker-compose.events.yml -f docker-compose.pulsar.yml up -d');
    return false;
  }
}

async function createNamespace(namespace) {
  const { namespace: ns, description, properties = {} } = namespace;
  
  try {
    // Check if namespace exists
    const parts = ns.split('/');
    const tenant = parts[0];
    const nsName = parts[1];

    await axios.get(`${PULSAR_ADMIN_URL}/admin/v2/namespaces/${ns}`);
    console.log(`  ℹ Namespace already exists: ${ns}`);
    return;
  } catch (error) {
    if (error.response?.status === 404) {
      // Create namespace
      try {
        await axios.put(`${PULSAR_ADMIN_URL}/admin/v2/namespaces/${ns}`, {}, {
          headers: { 'Content-Type': 'application/json' }
        });
        console.log(`  ✓ Created namespace: ${ns} (${description})`);

        // Set retention policies
        if (Object.keys(properties).length > 0) {
          // Set retention
          if (properties.retention_seconds) {
            await axios.post(
              `${PULSAR_ADMIN_URL}/admin/v2/namespaces/${ns}/retention`,
              {
                retentionTimeInMinutes: Math.floor(properties.retention_seconds / 60),
                retentionSizeInMB: 10240
              }
            );
            console.log(`    - Retention: ${properties.retention_seconds} seconds`);
          }
        }
      } catch (createError) {
        console.error(`  ✗ Failed to create namespace:`, createError.message);
      }
    } else {
      throw error;
    }
  }
}

async function createTopic(namespace, topic) {
  const { name, description, partitions = 1, retention = {} } = topic;
  const topicPath = `persistent://${namespace}/${name}`;

  try {
    // Check if topic exists
    try {
      await axios.get(`${PULSAR_ADMIN_URL}/admin/v2/persistent/${namespace}/${name}/stats`);
      console.log(`    ℹ Topic already exists: ${name}`);
      return;
    } catch (error) {
      if (error.response?.status !== 404) throw error;
    }

    // Create topic with partitions
    await axios.put(
      `${PULSAR_ADMIN_URL}/admin/v2/persistent/${namespace}/${name}`,
      { numPartitions: partitions }
    );
    console.log(`    ✓ Created topic: ${name} (${partitions} partitions, ${description})`);

    // Set retention policy
    if (Object.keys(retention).length > 0) {
      await axios.post(
        `${PULSAR_ADMIN_URL}/admin/v2/persistent/${namespace}/${name}/retention`,
        retention
      );
      const retentionDays = Math.floor(retention.retentionTimeInMinutes / 1440);
      console.log(`      - Retention: ${retention.retentionSizeInMB}MB, ${retentionDays} days`);
    }

  } catch (error) {
    console.error(`    ✗ Failed to create topic: ${error.message}`);
  }
}

async function deleteNamespaceAndTopics(namespace) {
  const { namespace: ns } = namespace;
  
  try {
    console.log(`  Deleting namespace: ${ns}`);
    
    // Delete all topics in namespace
    const stats = await axios.get(`${PULSAR_ADMIN_URL}/admin/v2/namespaces/${ns}/topics`);
    for (const topic of stats.data) {
      const topicName = topic.split('/').pop();
      try {
        await axios.delete(`${PULSAR_ADMIN_URL}/admin/v2/persistent/${ns}/${topicName}`);
        console.log(`    ✓ Deleted topic: ${topicName}`);
      } catch (error) {
        console.log(`    ℹ Topic cleanup: ${error.message}`);
      }
    }

    // Delete namespace
    await axios.delete(`${PULSAR_ADMIN_URL}/admin/v2/namespaces/${ns}`);
    console.log(`  ✓ Deleted namespace: ${ns}`);
  } catch (error) {
    console.log(`  ℹ Namespace not found or already deleted: ${ns}`);
  }
}

async function verifyTopicCreation(namespace, topicName) {
  try {
    const stats = await axios.get(
      `${PULSAR_ADMIN_URL}/admin/v2/persistent/${namespace}/${topicName}/stats`
    );
    
    console.log(`\n${topicName}:`);
    console.log(`  - Partitions: ${stats.data.partitions?.length || 1}`);
    console.log(`  - Messages: ${stats.data.msgInCounter || 0}`);
    console.log(`  - Bytes in: ${(stats.data.bytesInCounter / 1024 / 1024).toFixed(2)} MB`);
  } catch (error) {
    console.log(`  - Stats unavailable: ${error.message}`);
  }
}

// ============================================================================
// Main Setup
// ============================================================================

async function setup(cleanup = false) {
  console.log('\n' + '='.repeat(70));
  console.log('PULSAR INFRASTRUCTURE SETUP');
  console.log('='.repeat(70));

  const healthy = await checkClusterHealth();
  if (!healthy) {
    process.exit(1);
  }

  if (cleanup) {
    console.log('\n[CLEANUP MODE] Removing test infrastructure...\n');
    for (const ns of NAMESPACES) {
      if (ns.namespace !== 'public/default') {
        await deleteNamespaceAndTopics(ns);
      }
    }
    console.log('\n✓ Cleanup completed');
    return;
  }

  // Create namespaces
  console.log('\n[2] Creating namespaces...');
  for (const namespace of NAMESPACES) {
    if (namespace.namespace !== 'public/default') {
      await createNamespace(namespace);
    }
  }

  // Create topics
  console.log('\n[3] Creating topics and setting retention policies...');
  for (const topicGroup of TOPICS) {
    console.log(`\n  ${topicGroup.namespace}:`);
    for (const topic of topicGroup.topics) {
      await createTopic(topicGroup.namespace, topic);
    }
  }

  // Verify
  console.log('\n[4] Verifying topic creation...');
  for (const topicGroup of TOPICS) {
    console.log(`\n  ${topicGroup.namespace}:`);
    for (const topic of topicGroup.topics) {
      await verifyTopicCreation(topicGroup.namespace, topic.name);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('Pulsar infrastructure setup completed successfully!');
  console.log('='.repeat(70));
  console.log('\nNext steps:');
  console.log('  1. Run performance benchmark:');
  console.log('     node scripts/benchmark-pulsar-vs-rabbitmq.mjs');
  console.log('\n  2. Access Pulsar Manager UI:');
  console.log('     http://localhost:9527 (user: admin, pass: apachepulsar)');
  console.log('\n  3. Monitor metrics:');
  console.log('     http://localhost:8080/admin/v2 (Pulsar REST API)');
}

// Parse CLI arguments
const args = process.argv.slice(2);
const cleanup = args.includes('--cleanup');

setup(cleanup).catch((error) => {
  console.error('Setup failed:', error);
  process.exit(1);
});
