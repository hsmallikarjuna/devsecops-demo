// =============================================================================
// Jenkinsfile — Declarative Pipeline
// Project : devsecops-demo
// Stages  : Checkout → Install → Test → SonarQube → OWASP → Docker → Trivy
//           → Deploy → Archive
//
// Required Jenkins plugins:
//   • NodeJS Plugin            (nodejs tool)
//   • SonarQube Scanner Plugin (withSonarQubeEnv)
//   • OWASP Dependency-Check   (dependencyCheck / dependencyCheckPublisher)
//   • HTML Publisher Plugin    (publishHTML)
//   • Docker Pipeline Plugin   (docker commands via sh)
// =============================================================================

pipeline {
    agent any

    // NodeJS tool configured in: Manage Jenkins → Global Tool Configuration
    // Name must match exactly: "NodeJS-22"
    tools {
        nodejs 'NodeJS-22'
    }

    environment {
        APP_NAME            = 'devsecops-demo'
        APP_VERSION         = '1.0.0'
        DOCKER_IMAGE        = "${APP_NAME}:${BUILD_NUMBER}"
        DOCKER_IMAGE_LATEST = "${APP_NAME}:latest"
        SONAR_PROJECT_KEY   = 'devsecops-demo'
        REPORTS_DIR         = 'reports'
    }

    options {
        // Keep only the last 10 builds
        buildDiscarder(logRotator(numToKeepStr: '10'))
        // Prefix all log lines with timestamps
        timestamps()
        // Abort if the pipeline takes longer than 30 minutes
        timeout(time: 30, unit: 'MINUTES')
        // Prevent concurrent runs on the same branch
        disableConcurrentBuilds()
    }

    stages {

        // =====================================================================
        // Stage 1 — Checkout
        // =====================================================================
        stage('Checkout') {
            steps {
                echo '============================================================'
                echo ' Stage 1: Checkout Source Code'
                echo '============================================================'
                checkout scm
                sh '''
                    echo "Branch  : ${GIT_BRANCH:-local}"
                    echo "Commit  : ${GIT_COMMIT:-unknown}"
                    echo "Build # : ${BUILD_NUMBER}"
                    echo "Job     : ${JOB_NAME}"
                '''
            }
        }

        // =====================================================================
        // Stage 2 — Install Dependencies
        // =====================================================================
        stage('Install Dependencies') {
            steps {
                echo '============================================================'
                echo ' Stage 2: Install Node.js Dependencies'
                echo '============================================================'
                sh 'node --version'
                sh 'npm --version'
                // npm ci installs exact versions from package-lock.json
                // ensuring reproducible builds
                sh 'npm ci'
            }
        }

        // =====================================================================
        // Stage 3 — Unit Tests + Coverage
        // =====================================================================
        stage('Run Unit Tests') {
            steps {
                echo '============================================================'
                echo ' Stage 3: Run Unit Tests with Code Coverage'
                echo '============================================================'
                sh "mkdir -p ${REPORTS_DIR}"
                // Runs Jest with LCOV coverage output → reports/coverage/lcov.info
                sh 'npm run test:ci'
            }
            post {
                always {
                    // Publish interactive HTML coverage report in Jenkins UI
                    publishHTML(target: [
                        allowMissing         : true,
                        alwaysLinkToLastBuild: true,
                        keepAll              : true,
                        reportDir            : 'reports/coverage',
                        reportFiles          : 'index.html',
                        reportName           : 'Jest Coverage Report'
                    ])
                }
            }
        }

        // =====================================================================
        // Stage 4 — SonarQube Static Analysis
        // =====================================================================
        stage('SonarQube Analysis') {
            steps {
                echo '============================================================'
                echo ' Stage 4: Static Code Analysis via SonarQube'
                echo '============================================================'
                // "SonarQube" must match the server name in:
                // Manage Jenkins → Configure System → SonarQube servers
                withSonarQubeEnv('SonarQube') {
                    sh '''
                        npx sonar-scanner \
                          -Dsonar.projectKey=${SONAR_PROJECT_KEY} \
                          -Dsonar.projectName="${APP_NAME}" \
                          -Dsonar.projectVersion=${APP_VERSION} \
                          -Dsonar.sources=. \
                          -Dsonar.exclusions=node_modules/**,reports/**,test/**,.github/** \
                          -Dsonar.javascript.lcov.reportPaths=reports/coverage/lcov.info \
                          -Dsonar.sourceEncoding=UTF-8
                    '''
                }
            }
        }

        // =====================================================================
        // Stage 5 — OWASP Dependency-Check
        // =====================================================================
        stage('OWASP Dependency-Check') {
            steps {
                echo '============================================================'
                echo ' Stage 5: OWASP Dependency Vulnerability Scan'
                echo '============================================================'
                sh "mkdir -p ${REPORTS_DIR}"
                // "OWASP-DC" must match the tool name in:
                // Manage Jenkins → Global Tool Configuration → Dependency-Check
                dependencyCheck(
                    additionalArguments: """
                        --scan ./
                        --out ${REPORTS_DIR}/
                        --format HTML
                        --format XML
                        --prettyPrint
                        --enableRetired
                        --exclude node_modules/.cache/**
                    """,
                    odcInstallation: 'OWASP-DC'
                )
            }
            post {
                always {
                    // Parse results and add a trend graph to the Jenkins job
                    dependencyCheckPublisher(
                        pattern             : 'reports/dependency-check-report.xml',
                        failedTotalCritical : 0,
                        unstableTotalHigh   : 10,
                        stopBuild           : false
                    )
                }
            }
        }

        // =====================================================================
        // Stage 6 — Docker Build
        // =====================================================================
        stage('Docker Build') {
            steps {
                echo '============================================================'
                echo ' Stage 6: Build Docker Image'
                echo '============================================================'
                sh "docker build -t ${DOCKER_IMAGE} -t ${DOCKER_IMAGE_LATEST} ."
                sh "docker images | grep ${APP_NAME}"
            }
        }

        // =====================================================================
        // Stage 7 — Trivy Container Scan
        // =====================================================================
        stage('Trivy Scan') {
            steps {
                echo '============================================================'
                echo ' Stage 7: Trivy Container Image Vulnerability Scan'
                echo '============================================================'
                sh "mkdir -p ${REPORTS_DIR}"

                // Generate HTML report — catchError marks build UNSTABLE instead
                // of FAILURE so the pipeline always continues to the Archive stage
                catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
                    sh """
                        trivy image \
                            --format html \
                            --output ${REPORTS_DIR}/trivy-report.html \
                            --severity HIGH,CRITICAL \
                            --exit-code 1 \
                            ${DOCKER_IMAGE}
                    """
                }

                // Always print a human-readable table summary to the console log
                sh """
                    trivy image \
                        --format table \
                        --severity HIGH,CRITICAL \
                        --exit-code 0 \
                        ${DOCKER_IMAGE}
                """
            }
        }

        // =====================================================================
        // Stage 8 — Deploy Container
        // =====================================================================
        stage('Deploy Container') {
            steps {
                echo '============================================================'
                echo ' Stage 8: Deploy Docker Container (local)'
                echo '============================================================'
                sh """
                    # Gracefully stop and remove any previously running instance
                    docker stop ${APP_NAME} 2>/dev/null || true
                    docker rm   ${APP_NAME} 2>/dev/null || true

                    # Start the new container
                    docker run -d \
                        --name ${APP_NAME} \
                        --restart unless-stopped \
                        -p 3000:3000 \
                        -e NODE_ENV=production \
                        -e APP_VERSION=${APP_VERSION} \
                        ${DOCKER_IMAGE}
                """
                // Allow the container time to initialise before the smoke test
                sh 'sleep 5'
                sh "docker ps | grep ${APP_NAME}"
                // Smoke test: verify the health endpoint returns "UP"
                sh 'curl -sf http://localhost:3000/health | grep UP'
                sh 'curl -sf http://localhost:3000/'
                sh 'curl -sf http://localhost:3000/version'
            }
        }

        // =====================================================================
        // Stage 9 — Archive Reports
        // =====================================================================
        stage('Archive Reports') {
            steps {
                echo '============================================================'
                echo ' Stage 9: Archive Security & Test Reports'
                echo '============================================================'
                echo 'Archiving all generated reports as build artifacts...'
            }
            post {
                // always runs even when earlier stages failed or were unstable
                always {
                    // Attach every file under reports/ as a downloadable artifact
                    archiveArtifacts(
                        artifacts        : 'reports/**/*',
                        allowEmptyArchive: true,
                        fingerprint      : true
                    )
                    // Render OWASP Dependency-Check HTML in Jenkins sidebar
                    publishHTML(target: [
                        allowMissing         : true,
                        alwaysLinkToLastBuild: true,
                        keepAll              : true,
                        reportDir            : 'reports',
                        reportFiles          : 'dependency-check-report.html',
                        reportName           : 'OWASP Dependency Check'
                    ])
                    // Render Trivy HTML report in Jenkins sidebar
                    publishHTML(target: [
                        allowMissing         : true,
                        alwaysLinkToLastBuild: true,
                        keepAll              : true,
                        reportDir            : 'reports',
                        reportFiles          : 'trivy-report.html',
                        reportName           : 'Trivy Security Report'
                    ])
                }
            }
        }

    } // end stages

    // =========================================================================
    // Global Post Actions
    // =========================================================================
    post {
        always {
            echo "Pipeline finished — result: ${currentBuild.currentResult}"
            // Remove dangling Docker images to reclaim disk space
            sh 'docker image prune -f || true'
        }
        success {
            echo 'All stages passed. Application deployed and healthy.'
        }
        failure {
            echo 'Pipeline FAILED. Review the stage logs above for details.'
        }
        unstable {
            echo 'Pipeline UNSTABLE. Security vulnerabilities detected — review Trivy/OWASP reports.'
        }
    }
}
