# Local broker inspect — quick reference

Commands (compose files used by this workspace):

- Start stack (background):
  - `docker compose -f docker-compose.yml -f docker-compose.events.yml up -d --wait`
- List services and status:
  - `docker compose -f docker-compose.yml -f docker-compose.events.yml ps`
- Tail logs for a service (last 200 lines):
  - `docker compose -f docker-compose.yml -f docker-compose.events.yml logs --no-log-prefix --tail=200 <service>`
- Exec into a running service to inspect files:
  - `docker compose -f docker-compose.yml -f docker-compose.events.yml exec <service> sh -c 'ls -la <path>'`

Common paths to check inside containers

- Kafka data dir (on container): `/var/lib/kafka/data` (mounted from volume `cosmic-horizons_cosmic-horizons-kafka-data`)
- RabbitMQ data dir: `/var/lib/rabbitmq/mnesia` (volume `cosmic-horizons_cosmic-horizons-rabbitmq-data`)
- Pulsar data/logs: `/pulsar/data` and `/pulsar/logs` (pulsar standalone volumes)

Inspect Docker volumes (host)

- List project volumes:
  - `docker volume ls --filter label=com.docker.compose.project=cosmic-horizons`
- Inspect a specific volume to find its host mountpoint:
  - `docker volume inspect <volume_name>`

Notes & troubleshooting

- To view persisted Kafka topic directories: exec into the Kafka container and `ls -la /var/lib/kafka/data` — you should see topic partitions like `element.raw_data-0` and internal `__consumer_offsets-*` directories.
- If you see a service repeatedly reconnecting or "Node X disconnected" entries, check network/connectivity and broker resource limits; those INFO lines may be transient during restarts.
- RabbitMQ management UI is available on port 15672 by default; use it to inspect queues/exchanges and message counts.

If you want, I can add exact example `docker compose` commands for ephemeral volume inspection (running an alpine container to mount the volume). Request that and I'll add step-by-step commands.
