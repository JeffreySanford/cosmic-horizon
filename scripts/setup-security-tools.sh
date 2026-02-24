#!/usr/bin/env bash
# Bootstrap installer for security tools used by the project.
# Installs Trivy, Semgrep and detect-secrets where possible.

set -euo pipefail

RUN_INSTALL=${RUN_INSTALL:-0}
DRY_RUN=1
if [ "${RUN_INSTALL}" = "1" ]; then
  DRY_RUN=0
fi

echo "Bootstrap: security tools (trivy, semgrep, detect-secrets)"
echo "RUN_INSTALL=${RUN_INSTALL} (set to 1 to perform installs)."

run_cmd() {
  if [ "${DRY_RUN}" -eq 1 ]; then
    echo "[DRY-RUN] $*"
  else
    echo "[RUN] $*"
    eval "$*"
  fi
}

install_brew() {
  echo "Using Homebrew to install Trivy and Python tooling"
  run_cmd "brew install aquasecurity/trivy/trivy || true"
  run_cmd "python3 -m pip install --upgrade pip"
  run_cmd "python3 -m pip install --user semgrep detect-secrets"
}

install_apt() {
  echo "Using apt to install Trivy and Python tooling (non-interactive)"
  run_cmd "sudo DEBIAN_FRONTEND=noninteractive apt-get update"
  run_cmd "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y wget apt-transport-https gnupg lsb-release ca-certificates"
  run_cmd "wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add - || true"
  run_cmd "echo 'deb https://aquasecurity.github.io/trivy-repo/deb stable main' | sudo tee /etc/apt/sources.list.d/trivy.list"
  run_cmd "sudo DEBIAN_FRONTEND=noninteractive apt-get update"
  run_cmd "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y trivy || true"
  run_cmd "python3 -m pip install --upgrade pip"
  run_cmd "python3 -m pip install --user semgrep detect-secrets"
}

install_choco() {
  echo "Using Chocolatey to install Trivy and Python tooling (non-interactive)"
  run_cmd "choco install -y trivy || true"
  run_cmd "choco install -y python || true"
  run_cmd "python -m pip install --upgrade pip"
  run_cmd "python -m pip install --user semgrep detect-secrets"
}

install_pipx() {
  echo "Installing semgrep and detect-secrets via pipx (preferred)"
  run_cmd "python3 -m pip install --user pipx || true"
  run_cmd "python3 -m pipx ensurepath || true"
  run_cmd "python3 -m pipx install semgrep || true"
  run_cmd "python3 -m pipx install detect-secrets || true"
}

fallback_download_trivy() {
  echo "Falling back to downloading Trivy binary"
  ARCH=$(uname -m || true)
  TRIVY_URL="https://github.com/aquasecurity/trivy/releases/latest/download/trivy_0.38.0_Linux-64bit.tar.gz"
  run_cmd "mkdir -p /tmp/trivy-install && cd /tmp/trivy-install && curl -fsSL -o trivy.tar.gz \"${TRIVY_URL}\" || true"
  run_cmd "cd /tmp/trivy-install && tar -xzf trivy.tar.gz || true"
  run_cmd "sudo mv trivy /usr/local/bin/trivy || true"
}

is_wsl() {
  if grep -qi microsoft /proc/version 2>/dev/null; then
    return 0
  fi
  return 1
}

if command -v brew >/dev/null 2>&1; then
  install_brew
  install_pipx
  echo "Installed via Homebrew (or dry-run shown)."
  exit 0
fi

if command -v apt-get >/dev/null 2>&1 || is_wsl; then
  install_apt
  install_pipx
  echo "Installed via apt (or dry-run shown)."
  exit 0
fi

if command -v choco >/dev/null 2>&1; then
  install_choco
  echo "Installed via Chocolatey (or dry-run shown)."
  exit 0
fi

echo "No supported package manager detected. Attempting fallback binary download for Trivy and pip installs."
fallback_download_trivy
run_cmd "python3 -m pip install --user semgrep detect-secrets || true"
echo "If tools are still missing, please see scripts/INSTALL-SECURITY-TOOLS.md for manual steps."
exit 0
