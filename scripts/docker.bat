@echo off
REM VLASS Portal Docker Manager Script for Windows
REM Provides convenient commands for managing Docker containers with vlass- prefix

setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
set COMPOSE_FILE=%SCRIPT_DIR%..\docker-compose.yml

REM Function to check docker status
:check_docker
docker info >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker is not running. Please start Docker Desktop.
  exit /b 1
)
goto :eof

REM Start containers
:start
call :check_docker
echo [VLASS] Starting VLASS containers...
docker-compose -f "%COMPOSE_FILE%" up -d
echo [VLASS] Containers started successfully!
timeout /t 2 /nobreak
docker-compose -f "%COMPOSE_FILE%" ps
echo [VLASS] Waiting for databases to be ready...
timeout /t 5 /nobreak
echo [VLASS] ✓ Postgres: localhost:5432
echo [VLASS] ✓ Redis: localhost:6379
goto :eof

REM Stop containers
:stop
call :check_docker
echo [VLASS] Stopping VLASS containers...
docker-compose -f "%COMPOSE_FILE%" down
echo [VLASS] Containers stopped.
goto :eof

REM Restart containers
:restart
call :check_docker
echo [VLASS] Restarting VLASS containers...
docker-compose -f "%COMPOSE_FILE%" restart
echo [VLASS] Containers restarted.
goto :eof

REM Clean containers and volumes
:clean
call :check_docker
echo [WARN] This will delete containers and volumes. Continue? (y/n)
set /p response=
if /i "!response!"=="y" (
  echo [VLASS] Removing containers and volumes...
  docker-compose -f "%COMPOSE_FILE%" down -v
  echo [VLASS] Cleaned successfully.
) else (
  echo [VLASS] Cancelled.
)
goto :eof

REM View logs
:logs
call :check_docker
if "%~1"=="" (
  docker-compose -f "%COMPOSE_FILE%" logs -f
) else (
  docker-compose -f "%COMPOSE_FILE%" logs -f %~1
)
goto :eof

REM Access Postgres CLI
:psql
call :check_docker
echo [VLASS] Connecting to Postgres...
docker-compose -f "%COMPOSE_FILE%" exec vlass-postgres psql -U vlass_user -d vlass_portal
goto :eof

REM Access Redis CLI
:redis
call :check_docker
echo [VLASS] Connecting to Redis...
docker-compose -f "%COMPOSE_FILE%" exec vlass-redis redis-cli -a vlass_redis_dev
goto :eof

REM Status
:status
call :check_docker
echo [VLASS] Container Status:
docker-compose -f "%COMPOSE_FILE%" ps
goto :eof

REM Help
:help
(
  echo VLASS Portal Docker Manager
  echo.
  echo Usage: docker.bat ^<command^>
  echo.
  echo Commands:
  echo   start       Start all containers ^(Postgres, Redis^)
  echo   stop        Stop all containers
  echo   restart     Restart all containers
  echo   clean       Remove containers and volumes ^(destructive^)
  echo   logs        View container logs ^(add service name for specific logs^)
  echo   psql        Connect to Postgres CLI
  echo   redis       Connect to Redis CLI
  echo   status      Show container status
  echo   help        Show this help message
  echo.
  echo Examples:
  echo   docker.bat start
  echo   docker.bat logs vlass-postgres
  echo   docker.bat psql
  echo   docker.bat redis
)
goto :eof

REM Main command routing
if "%~1"=="" goto help
if /i "%~1"=="start" goto start
if /i "%~1"=="stop" goto stop
if /i "%~1"=="restart" goto restart
if /i "%~1"=="clean" goto clean
if /i "%~1"=="logs" goto logs
if /i "%~1"=="psql" goto psql
if /i "%~1"=="redis" goto redis
if /i "%~1"=="status" goto status
if /i "%~1"=="help" goto help

echo [ERROR] Unknown command: %~1
goto help
