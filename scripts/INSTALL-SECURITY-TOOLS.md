# Security Tools Installation Guide

This file contains quick install instructions for Trivy, Semgrep and detect-secrets on common developer platforms.

macOS (Homebrew)

brew install aquasecurity/trivy/trivy
pip3 install --user semgrep detect-secrets

Ubuntu / Debian

## Trivy

sudo apt-get update && sudo apt-get install -y wget apt-transport-https gnupg
wget -qO - <https://aquasecurity.github.io/trivy-repo/deb/public.key> | sudo apt-key add -
sudo add-apt-repository "deb <https://aquasecurity.github.io/trivy-repo/deb> stable main"
sudo apt-get update && sudo apt-get install -y trivy

    # Python tools

python3 -m pip install --user semgrep detect-secrets

Windows (Chocolatey)

choco install trivy
python -m pip install --user semgrep detect-secrets

CI (GitHub Actions)

Use the included workflow at `.github/workflows/security-scan.yml` which installs and runs Semgrep and detect-secrets and uses the Trivy action to scan the repository filesystem. To enable image scanning, adapt the workflow to build images and call Trivy `image` against them.

Image build and Trivy image scanning in CI

The repository includes a GitHub Actions workflow that now builds the API and Web Docker images (if Dockerfiles are present at `./apps/cosmic-horizons-api/Dockerfile` and `./apps/cosmic-horizons-web/Dockerfile`) and runs Trivy image scans against the built images. The workflow steps:

- Build `cosmic-horizons-api:ci` from `./apps/cosmic-horizons-api` if a Dockerfile exists.
- Build `cosmic-horizons-web:ci` from `./apps/cosmic-horizons-web` if a Dockerfile exists.
- Run `semgrep` and `detect-secrets`.
- Run `aquasecurity/trivy-action` to scan the built images with severity `HIGH,CRITICAL`.

If you want Trivy to scan additional images, modify `.github/workflows/security-scan.yml` to build those images and add corresponding Trivy steps.

Developer onboarding script

A convenience script `scripts/setup-security-tools.sh` is included to help developers install the required tools locally. It attempts to detect the platform and uses Homebrew / apt / Chocolatey where available and installs Python tools via `pip` or `pipx`:

- macOS: uses Homebrew to install Trivy and pip/pipx to install `semgrep` and `detect-secrets`.
- Ubuntu/Debian: adds the Trivy repo and installs it via apt, installs `semgrep` and `detect-secrets` via `pip` or `pipx`.
- Windows (Chocolatey): installs Trivy via Chocolatey and Python packages via `pip`.

Run the script locally:

    ```bash
    ./scripts/setup-security-tools.sh
    ```

Or follow the manual steps above per platform.

Notes

- Semgrep and detect-secrets are installed via pip; consider using `pipx` for isolated installs.
- Trivy is an external binary; CI runners (ubuntu-latest) support installing it or use the `aquasecurity/trivy-action` (as configured in the workflow).
