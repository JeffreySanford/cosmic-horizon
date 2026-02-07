#!/bin/bash

# VLASS Portal Docker Manager Script
# Provides convenient commands for managing Docker containers with vlass- prefix

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
  echo -e "${GREEN}[VLASS]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
  if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker Desktop."
    exit 1
  fi
}

# Start containers
start() {
  check_docker
  print_status "Starting VLASS containers..."
  docker-compose -f "$COMPOSE_FILE" up -d
  print_status "Containers started successfully!"
  sleep 2
  docker-compose -f "$COMPOSE_FILE" ps
  print_status "Waiting for databases to be ready..."
  sleep 5
  print_status "✓ Postgres: localhost:5432"
  print_status "✓ Redis: localhost:6379"
}

# Stop containers
stop() {
  check_docker
  print_status "Stopping VLASS containers..."
  docker-compose -f "$COMPOSE_FILE" down
  print_status "Containers stopped."
}

# Restart containers
restart() {
  check_docker
  print_status "Restarting VLASS containers..."
  docker-compose -f "$COMPOSE_FILE" restart
  print_status "Containers restarted."
}

# Clean containers and volumes
clean() {
  check_docker
  print_warning "This will delete containers and volumes. Continue? (y/n)"
  read -r response
  if [[ "$response" == "y" ]]; then
    print_status "Removing containers and volumes..."
    docker-compose -f "$COMPOSE_FILE" down -v
    print_status "Cleaned successfully."
  else
    print_status "Cancelled."
  fi
}

# View logs
logs() {
  check_docker
  docker-compose -f "$COMPOSE_FILE" logs -f "${1:-.}"
}

# Access Postgres CLI
psql() {
  check_docker
  print_status "Connecting to Postgres..."
  docker-compose -f "$COMPOSE_FILE" exec vlass-postgres psql -U vlass_user -d vlass_portal
}

# Access Redis CLI
redis() {
  check_docker
  print_status "Connecting to Redis..."
  docker-compose -f "$COMPOSE_FILE" exec vlass-redis redis-cli -a vlass_redis_dev
}

# Status
status() {
  check_docker
  print_status "Container Status:"
  docker-compose -f "$COMPOSE_FILE" ps
}

# Help
show_help() {
  cat << EOF
VLASS Portal Docker Manager

Usage: ./scripts/docker.sh <command>

Commands:
  start       Start all containers (Postgres, Redis)
  stop        Stop all containers
  restart     Restart all containers
  clean       Remove containers and volumes (⚠️  destructive)
  logs        View container logs (add service name for specific logs)
  psql        Connect to Postgres CLI
  redis       Connect to Redis CLI
  status      Show container status
  help        Show this help message

Examples:
  ./scripts/docker.sh start
  ./scripts/docker.sh logs vlass-postgres
  ./scripts/docker.sh psql
  ./scripts/docker.sh redis

EOF
}

# Main command routing
case "${1:-help}" in
  start)
    start
    ;;
  stop)
    stop
    ;;
  restart)
    restart
    ;;
  clean)
    clean
    ;;
  logs)
    logs "$2"
    ;;
  psql)
    psql
    ;;
  redis)
    redis
    ;;
  status)
    status
    ;;
  help)
    show_help
    ;;
  *)
    print_error "Unknown command: $1"
    show_help
    exit 1
    ;;
esac
