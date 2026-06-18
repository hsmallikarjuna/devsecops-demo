# DevSecOps Demo — Secure CI/CD Pipeline

> A production-ready Node.js/Express REST API that demonstrates an end-to-end
> **Secure CI/CD pipeline** using Jenkins, SonarQube, OWASP Dependency-Check,
> Trivy, and Docker.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Prerequisites](#3-prerequisites)
4. [Installation](#4-installation)
5. [Running Locally](#5-running-locally)
6. [Running with Docker](#6-running-with-docker)
7. [Jenkins Configuration](#7-jenkins-configuration)
8. [SonarQube Configuration](#8-sonarqube-configuration)
9. [OWASP Dependency-Check](#9-owasp-dependency-check)
10. [Trivy Container Scan](#10-trivy-container-scan)
11. [Pipeline Explanation](#11-pipeline-explanation)
12. [API Reference](#12-api-reference)
13. [DevSecOps Features](#13-devsecops-features)
14. [Intentional Demo Issues](#14-intentional-demo-issues)
15. [Screenshots](#15-screenshots)
16. [Folder Structure](#16-folder-structure)
17. [Future Improvements](#17-future-improvements)

---

## 1. Project Overview

This project showcases how to embed **security at every stage** of a software
delivery pipeline — the DevSecOps approach.

| Concern | Tool |
|---|---|
| Static code analysis (SAST) | SonarQube |
| Dependency vulnerability scan (SCA) | OWASP Dependency-Check |
| Container image scan | Trivy |
| Runtime security headers | Helmet.js |
| CI/CD orchestration | Jenkins (Declarative Pipeline) |
| Containerisation | Docker (node:22-alpine) |
| Unit testing + coverage | Jest + Supertest |

The application itself is a lightweight **Express REST API** with three
endpoints. Its simplicity keeps build times under 2 minutes so you can focus
on the pipeline, not the application code.

---

## 2. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    Developer Workstation                      │
│                  git push / pull request                      │
└─────────────────────────┬────────────────────────────────────┘
                           │
                           ▼  Webhook / Poll SCM
┌──────────────────────────────────────────────────────────────┐
│                     GitHub / GitLab                           │
│                    (Source Control)                           │
└─────────────────────────┬────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│              Jenkins Declarative Pipeline                     │
│                                                              │
│  ┌───────────┐  ┌──────────┐  ┌────────────┐               │
│  │ 1.Checkout│→ │2. Install│→ │ 3. Tests   │               │
│  │           │  │   Deps   │  │ + Coverage │               │
│  └───────────┘  └──────────┘  └─────┬──────┘               │
│                                      │                       │
│  ┌───────────┐  ┌──────────┐  ┌─────▼──────┐               │
│  │5. OWASP   │← │4.Sonar   │←─│  lcov.info │               │
│  │  Dep-Chk  │  │  Qube    │  └────────────┘               │
│  └─────┬─────┘  └──────────┘                               │
│        │                                                     │
│  ┌─────▼─────┐  ┌──────────┐  ┌────────────┐               │
│  │6. Docker  │→ │ 7. Trivy │→ │ 8. Deploy  │               │
│  │   Build   │  │   Scan   │  │ Container  │               │
│  └───────────┘  └──────────┘  └─────┬──────┘               │
│                                      │                       │
│                              ┌───────▼──────┐               │
│                              │ 9. Archive   │               │
│                              │   Reports    │               │
│                              └──────────────┘               │
└──────────────────────────────────────────────────────────────┘
         │              │              │             │
         ▼              ▼              ▼             ▼
  ┌───────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ SonarQube │  │  OWASP   │  │  Trivy   │  │  Docker  │
  │  Server   │  │  Report  │  │  Report  │  │Container │
  │(dashboard)│  │  .html   │  │  .html   │  │Port:3000 │
  └───────────┘  └──────────┘  └──────────┘  └──────────┘
```

---

## 3. Prerequisites

### Local Development

| Tool | Minimum Version | Check |
|---|---|---|
| Node.js | 18.x | `node --version` |
| npm | 8.x | `npm --version` |
| Docker | 20.x | `docker --version` |
| Git | 2.x | `git --version` |

### Jenkins Server

| Component | Notes |
|---|---|
| Jenkins | LTS 2.426+ |
| NodeJS Plugin | Configured as `NodeJS-22` in Global Tool Configuration |
| SonarQube Scanner Plugin | Server named `SonarQube` in Configure System |
| OWASP Dependency-Check Plugin | Tool named `OWASP-DC` in Global Tool Configuration |
| HTML Publisher Plugin | For rendering HTML reports in the Jenkins UI |
| Docker | Installed on the Jenkins agent and accessible to the Jenkins user |
| Trivy | Installed on the Jenkins agent (`trivy` on `$PATH`) |
| curl | Installed on the Jenkins agent (used for smoke test) |

---

## 4. Installation

```bash
# Clone the repository
git clone <your-repository-url>
cd devsecops-demo

# Install all dependencies (including devDependencies for testing)
npm install
```

---

## 5. Running Locally

```bash
# Start the development server
npm start

# The API is now available at http://localhost:3000
curl http://localhost:3000/
curl http://localhost:3000/health
curl http://localhost:3000/version
```

**Run unit tests:**

```bash
# Run tests only
npm test

# Run tests with HTML + LCOV coverage report
npm run test:coverage

# Run tests in CI mode (generates lcov.info for SonarQube)
npm run test:ci
```

Coverage reports are written to `reports/coverage/`.

---

## 6. Running with Docker

```bash
# Build the image
docker build -t devsecops-demo:latest .

# Run the container
docker run -d \
  --name devsecops-demo \
  -p 3000:3000 \
  -e NODE_ENV=production \
  devsecops-demo:latest

# Check logs
docker logs devsecops-demo

# Smoke test
curl http://localhost:3000/health

# Stop and remove
docker stop devsecops-demo && docker rm devsecops-demo
```

**Override the version at runtime:**

```bash
docker run -d \
  --name devsecops-demo \
  -p 3000:3000 \
  -e APP_VERSION=2.0.0 \
  devsecops-demo:latest
```

---

## 7. Jenkins Configuration

### Step 1 — Install Required Plugins

Navigate to **Manage Jenkins → Plugin Manager** and install:

- NodeJS Plugin
- SonarQube Scanner Plugin
- OWASP Dependency-Check Plugin
- HTML Publisher Plugin

### Step 2 — Configure NodeJS Tool

**Manage Jenkins → Global Tool Configuration → NodeJS → Add NodeJS**

| Field | Value |
|---|---|
| Name | `NodeJS-22` |
| Version | Node.js 22.x |
| Install automatically | ✅ |

### Step 3 — Configure SonarQube Server

**Manage Jenkins → Configure System → SonarQube servers → Add SonarQube**

| Field | Value |
|---|---|
| Name | `SonarQube` |
| Server URL | `http://localhost:9000` (or your SonarQube host) |
| Server authentication token | (paste token from SonarQube) |

### Step 4 — Configure OWASP Dependency-Check Tool

**Manage Jenkins → Global Tool Configuration → Dependency-Check → Add**

| Field | Value |
|---|---|
| Name | `OWASP-DC` |
| Install automatically | ✅ |

### Step 5 — Create the Pipeline Job

1. **New Item → Pipeline**
2. Under **Pipeline** set:
   - Definition: `Pipeline script from SCM`
   - SCM: `Git`
   - Repository URL: `<your-repository-url>`
   - Script Path: `Jenkinsfile`
3. Save and click **Build Now**

---

## 8. SonarQube Configuration

### Start SonarQube (Docker — quickest way)

```bash
docker run -d \
  --name sonarqube \
  -p 9000:9000 \
  sonarqube:lts-community
```

Open `http://localhost:9000` — default credentials are `admin / admin`.

### Create a Project

1. **Projects → Create project → Manually**
2. **Project key:** `devsecops-demo`
3. **Project display name:** `DevSecOps Demo`
4. Generate a token and copy it into Jenkins (Step 3 above)

### Configuration File

`sonar-project.properties` at the project root is pre-configured:

```properties
sonar.projectKey=devsecops-demo
sonar.projectName=DevSecOps Demo
sonar.projectVersion=1.0.0
sonar.sources=.
sonar.tests=test
sonar.exclusions=node_modules/**,reports/**,test/**,.github/**
sonar.javascript.lcov.reportPaths=reports/coverage/lcov.info
sonar.sourceEncoding=UTF-8
```

SonarQube will report the intentional code smells:

- **S1481** — unused variable `debugMode`
- **S2228** — `console.log` in production code
- **S1439** — loose equality (`==`) instead of `===`

---

## 9. OWASP Dependency-Check

OWASP Dependency-Check scans project dependencies against the **NVD CVE
database** and reports any known vulnerabilities.

### Running Manually

```bash
# Requires dependency-check CLI installed locally
dependency-check \
  --scan . \
  --out reports/ \
  --format HTML \
  --format XML \
  --enableRetired
```

### Expected Findings (Demo)

The dependency `lodash@4.17.4` is intentionally pinned at a vulnerable version
to generate findings for the demo:

| CVE | Severity | Description |
|---|---|---|
| CVE-2018-3721 | High | Prototype pollution via `merge` |
| CVE-2019-10744 | Critical | Prototype pollution via `defaultsDeep` |
| CVE-2019-1010266 | Medium | Regular expression denial of service |

> **These CVEs are included for demonstration purposes only.**  
> `lodash` is imported in `package.json` but none of the vulnerable methods  
> are called anywhere in the application code.

### Reports

Jenkins archives the following to the build:

| File | Content |
|---|---|
| `reports/dependency-check-report.html` | Interactive HTML report |
| `reports/dependency-check-report.xml` | XML for Jenkins trend graph |

---

## 10. Trivy Container Scan

Trivy scans the built Docker image for OS-level and application-level CVEs.

### Running Manually

```bash
# Scan and print table to stdout
trivy image \
  --severity HIGH,CRITICAL \
  devsecops-demo:latest

# Generate HTML report
trivy image \
  --format html \
  --output reports/trivy-report.html \
  --severity HIGH,CRITICAL \
  devsecops-demo:latest
```

### Pipeline Behaviour

| Trivy Outcome | Pipeline Result |
|---|---|
| No HIGH/CRITICAL CVEs | SUCCESS ✅ |
| HIGH/CRITICAL CVEs found | UNSTABLE ⚠️ (pipeline continues — reports still archived) |

The `catchError(buildResult: 'UNSTABLE')` block in stage 7 ensures archiving
always runs even when vulnerabilities are detected.

### Trivy Version Requirement

HTML output (`--format html`) requires **Trivy ≥ 0.44.0**.

```bash
trivy --version
```

---

## 11. Pipeline Explanation

```
Stage 1  Checkout            — pulls source code from SCM
Stage 2  Install Dependencies — npm ci (reproducible, locked versions)
Stage 3  Run Unit Tests       — Jest + Supertest, generates LCOV coverage
Stage 4  SonarQube Analysis   — SAST scan; sends results + coverage to server
Stage 5  OWASP Dependency-Chk — SCA scan against NVD CVE database
Stage 6  Docker Build         — builds production image (node:22-alpine)
Stage 7  Trivy Scan           — CVE scan of the Docker image layers
Stage 8  Deploy Container     — runs container locally, performs smoke test
Stage 9  Archive Reports      — archives all HTML/XML reports as artifacts
```

**Key design decisions:**

- `npm ci` instead of `npm install` — guarantees the exact versions in
  `package-lock.json` are installed, preventing supply-chain drift.
- `--only=production` in the Dockerfile — devDependencies (Jest, Supertest)
  never enter the image.
- Non-root Docker user (`appuser:1001`) — follows the principle of least
  privilege; container cannot write to system paths.
- `catchError` around Trivy — security findings generate an `UNSTABLE` build
  rather than hard-failing so the Archive stage always runs.
- `disableConcurrentBuilds()` — prevents race conditions on shared Docker
  resources (e.g., naming conflicts on the deployed container).

---

## 12. API Reference

| Method | Path | Response |
|---|---|---|
| GET | `/` | `{ "message": "DevSecOps Demo API" }` |
| GET | `/health` | `{ "status": "UP" }` |
| GET | `/version` | `{ "version": "1.0.0" }` |

All endpoints return `Content-Type: application/json` with HTTP 200.  
Unknown paths return HTTP 404 with `{ "error": "Not Found" }`.

---

## 13. DevSecOps Features

| Feature | Implementation |
|---|---|
| Security HTTP headers | `helmet()` middleware (11 headers: CSP, HSTS, X-Frame-Options, …) |
| CORS | `cors()` restricted to `ALLOWED_ORIGINS` env var in production |
| Request logging | `morgan('combined')` — Apache Combined Log Format |
| Input validation | `express.json({ limit: '10kb' })` — rejects oversized payloads |
| Centralized error handling | 4-argument Express error middleware in `app.js` |
| Environment variables | `PORT`, `NODE_ENV`, `APP_VERSION`, `ALLOWED_ORIGINS`, `DEBUG_MODE` |
| Non-root container | Docker user `appuser` (UID 1001) |
| Minimal base image | `node:22-alpine` (~60 MB compressed) |
| Reproducible builds | `npm ci` + `package-lock.json` |

---

## 14. Intentional Demo Issues

Three minor issues are embedded so the DevSecOps tools have something to detect.

### Code Smells (SonarQube)

| File | Line | Rule | Issue |
|---|---|---|---|
| `app.js` | ~14 | `javascript:S1481` | Unused variable `debugMode` |
| `app.js` | ~32 | `javascript:S2228` | `console.log` in production code |
| `routes/version.js` | ~23 | `javascript:S1439` | Loose equality `==` instead of `===` |

### Vulnerable Dependency (OWASP Dependency-Check)

| Package | Version | CVE | CVSS |
|---|---|---|---|
| `lodash` | `4.17.4` | CVE-2019-10744 | 9.8 Critical |
| `lodash` | `4.17.4` | CVE-2018-3721 | 6.5 High |

> **Safe for demo:** no vulnerable `lodash` methods are called at runtime.
> Upgrade to `lodash@4.17.21` to resolve these findings in production.

---

## 15. Screenshots

> Replace the placeholder text below with actual screenshots after running
> the pipeline.

### Jenkins Pipeline View

```
[ Screenshot: Jenkins Blue Ocean / Stage View showing all 9 stages green ]
```

### SonarQube Dashboard

```
[ Screenshot: SonarQube project dashboard showing code smells detected ]
```

### OWASP Dependency-Check Report

```
[ Screenshot: HTML report showing lodash CVE-2019-10744 ]
```

### Trivy Scan Report

```
[ Screenshot: Trivy HTML report showing image vulnerabilities ]
```

### Jest Coverage Report

```
[ Screenshot: Coverage summary showing >80% across all files ]
```

---

## 16. Folder Structure

```
devsecops-demo/
│
├── app.js                    # Express application entry point
├── package.json              # Dependencies, scripts, Jest config
├── package-lock.json         # Locked dependency tree (generated by npm)
│
├── routes/
│   ├── health.js             # GET /health → { status: "UP" }
│   └── version.js            # GET /version → { version: "x.y.z" }
│
├── test/
│   └── app.test.js           # Jest + Supertest endpoint tests
│
├── reports/                  # Generated at build time (gitignored except .gitkeep)
│   ├── .gitkeep
│   ├── coverage/             # Jest LCOV coverage (generated)
│   ├── dependency-check-report.html  (generated by OWASP)
│   ├── dependency-check-report.xml   (generated by OWASP)
│   └── trivy-report.html             (generated by Trivy)
│
├── Dockerfile                # Production image (node:22-alpine, non-root)
├── Jenkinsfile               # Declarative 9-stage CI/CD pipeline
├── sonar-project.properties  # SonarQube scanner configuration
├── .dockerignore             # Files excluded from Docker build context
├── .gitignore                # Files excluded from version control
├── .github/                  # GitHub-specific files (Actions, templates)
│   └── .gitkeep
└── README.md                 # This file
```

---

## 17. Future Improvements

| Area | Improvement |
|---|---|
| **Multi-stage Docker build** | Separate builder stage to compile/bundle assets, copy only artefacts to final stage |
| **Secrets management** | Integrate HashiCorp Vault or AWS Secrets Manager instead of env vars |
| **DAST** | Add OWASP ZAP dynamic application security testing stage |
| **Image signing** | Sign Docker images with Cosign / Notary for supply-chain integrity |
| **SBOM** | Generate a Software Bill of Materials (Syft/CycloneDX) as a pipeline artefact |
| **Quality Gate** | Add SonarQube quality gate (`waitForQualityGate()`) to block merges on failures |
| **Kubernetes deployment** | Replace `docker run` stage with `kubectl apply` using Helm charts |
| **Branch strategy** | Separate pipelines for `feature/*` (test only) and `main` (full scan + deploy) |
| **Notifications** | Add Slack / Teams / email notifications on pipeline failure or `UNSTABLE` |
| **Performance testing** | Add k6 or Artillery load testing stage after deployment |
| **License scanning** | Add FOSSA or License Finder to flag copyleft dependencies |
| **Prettier / ESLint** | Add linting stage before unit tests for consistent code style |

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

*Built with Jenkins · SonarQube · OWASP Dependency-Check · Trivy · Docker*
