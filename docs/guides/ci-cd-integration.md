# CI/CD Integration Guide

DocGen is designed to integrate into continuous integration and continuous delivery pipelines. This guide provides complete, copy-paste-ready configurations for GitHub Actions, GitLab CI, Jenkins, and Azure DevOps, along with guidance on quality gates, monorepo strategies, and JSON output schemas.

---

## 1. GitHub Actions

### Validation on Pull Request

This workflow validates documentation coverage every time a pull request targets `main`. It installs dependencies, runs `docgen validate --json`, posts a coverage summary as a PR comment, and fails the check if coverage falls below the configured threshold.

```yaml
# .github/workflows/docs-validate.yml
name: Documentation Validation

on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write

jobs:
  doc-validate:
    name: Validate Documentation Coverage
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run documentation validation
        id: validate
        run: npx docgen validate --json > doc-report.json

      - name: Upload coverage report artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: doc-coverage-report
          path: doc-report.json

      - name: Post coverage report as PR comment
        if: always() && github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('doc-report.json', 'utf8'));

            const icon = report.coverage.passed ? '✅' : '❌';
            const status = report.coverage.passed ? 'PASSED' : 'FAILED';

            let body = `## ${icon} Documentation Coverage: ${report.coverage.overall}%\n\n`;
            body += `**Threshold:** ${report.coverage.threshold}% | **Status:** ${status}\n\n`;

            if (report.coverage.modules && report.coverage.modules.length > 0) {
              body += `| Module | Coverage |\n`;
              body += `|--------|----------|\n`;
              for (const m of report.coverage.modules) {
                const mIcon = m.coverage >= report.coverage.threshold ? '✅' : '⚠️';
                body += `| ${mIcon} ${m.name} | ${m.coverage}% |\n`;
              }
              body += '\n';
            }

            if (report.violations && report.violations.length > 0) {
              const errors = report.violations.filter(v => v.level === 'error');
              const warnings = report.violations.filter(v => v.level === 'warn');

              if (errors.length > 0) {
                body += `### Errors (${errors.length})\n`;
                for (const e of errors.slice(0, 10)) {
                  body += `- \`[${e.rule}]\` ${e.message}\n`;
                }
                body += '\n';
              }

              if (warnings.length > 0) {
                body += `### Warnings (${warnings.length})\n`;
                for (const w of warnings.slice(0, 10)) {
                  body += `- \`[${w.rule}]\` ${w.message}\n`;
                }
                body += '\n';
              }
            }

            if (report.coverage.undocumented && report.coverage.undocumented.length > 0) {
              body += `<details><summary>Undocumented items (${report.coverage.undocumented.length})</summary>\n\n`;
              for (const item of report.coverage.undocumented.slice(0, 50)) {
                body += `- \`${item}\`\n`;
              }
              if (report.coverage.undocumented.length > 50) {
                body += `\n_...and ${report.coverage.undocumented.length - 50} more_\n`;
              }
              body += `</details>\n`;
            }

            body += `\n_Duration: ${report.duration}ms_`;

            // Find and update existing comment or create new one
            const { data: comments } = await github.rest.issues.listComments({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
            });

            const marker = '## ✅ Documentation Coverage:';
            const markerFail = '## ❌ Documentation Coverage:';
            const existing = comments.find(c =>
              c.body.startsWith(marker) || c.body.startsWith(markerFail)
            );

            if (existing) {
              await github.rest.issues.updateComment({
                comment_id: existing.id,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body,
              });
            } else {
              await github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body,
              });
            }

      - name: Fail if coverage below threshold
        run: |
          node -e "
            const report = JSON.parse(require('fs').readFileSync('doc-report.json', 'utf8'));
            if (!report.coverage.passed) {
              console.error('Documentation coverage ' + report.coverage.overall + '% is below threshold ' + report.coverage.threshold + '%');
              process.exit(1);
            }
            const errors = (report.violations || []).filter(v => v.level === 'error');
            if (errors.length > 0) {
              console.error('Found ' + errors.length + ' validation error(s)');
              process.exit(1);
            }
            console.log('Documentation validation passed at ' + report.coverage.overall + '%');
          "
```

### Generation on Merge to Main

This workflow triggers when code is pushed to `main`, generates documentation in both Markdown and HTML formats, and deploys the HTML output to GitHub Pages. It includes caching for `node_modules` to speed up builds.

```yaml
# .github/workflows/docs-generate.yml
name: Generate & Deploy Documentation

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

# Prevent concurrent deployments
concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  doc-generate:
    name: Generate Documentation
    runs-on: ubuntu-latest

    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Cache node_modules
        uses: actions/cache@v4
        id: npm-cache
        with:
          path: node_modules
          key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-node-

      - name: Install dependencies
        if: steps.npm-cache.outputs.cache-hit != 'true'
        run: npm ci

      - name: Generate documentation (Markdown + HTML)
        run: npx docgen generate --format markdown html

      - name: Upload generation report
        uses: actions/upload-artifact@v4
        with:
          name: doc-generation-report
          path: |
            docs/api/
            docs-site/build/

      - name: Setup GitHub Pages
        uses: actions/configure-pages@v4

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: docs-site/build

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### Using GitHubActionsReporter

DocGen includes a built-in `GitHubActionsReporter` that automatically detects the GitHub Actions environment and produces native integrations. The reporter is defined in `packages/cli/src/reporters/index.ts`.

**Step Summary Output**

When running inside GitHub Actions, the reporter writes a formatted Markdown table to `$GITHUB_STEP_SUMMARY`. This table appears directly on the workflow run summary page without any additional configuration:

| Metric   | Value                           |
|----------|---------------------------------|
| Modules  | Total number of parsed modules  |
| Members  | Total number of parsed members  |
| Coverage | Average coverage percentage     |
| Files    | Number of generated files       |
| Time     | Total pipeline duration in ms   |

The reporter detects the environment by checking for the `GITHUB_STEP_SUMMARY` environment variable. If present, it appends the summary content using `fs.appendFileSync`.

**Error Annotations**

Every pipeline error is emitted as a GitHub Actions error annotation using the `::error` workflow command:

```
::error title=DocGen <phase>::<message>
```

These annotations appear inline in the "Files changed" tab of pull requests and on the workflow summary, making it straightforward to identify which phase of the documentation pipeline failed (parsing, validation, generation, etc.).

**Low Coverage Warnings**

Modules with documentation coverage below 50% receive file-level warning annotations:

```
::warning file=<filePath>::Low doc coverage (<coverage>%) for <moduleName>
```

These warnings are attached to the specific source file, so reviewers see them directly when viewing changed files in a pull request.

**Output Variables**

The reporter sets two output variables that downstream steps or jobs can consume:

| Variable   | Description                         |
|------------|-------------------------------------|
| `coverage` | The average documentation coverage percentage |
| `modules`  | The total number of parsed modules  |

Consume these outputs in subsequent steps:

```yaml
- name: Generate docs
  id: docgen
  run: npx docgen generate

- name: Use coverage output
  run: echo "Documentation coverage is ${{ steps.docgen.outputs.coverage }}%"
```

> **Note:** The `::set-output` command is used for compatibility. For newer GitHub Actions runners, you may need to migrate to writing to `$GITHUB_OUTPUT` if `set-output` is deprecated in your environment.

---

## 2. GitLab CI

The following `.gitlab-ci.yml` validates documentation on merge requests, generates documentation on the `main` branch, and deploys to GitLab Pages with cached `node_modules`.

```yaml
# .gitlab-ci.yml
image: node:20

stages:
  - validate
  - generate
  - deploy

variables:
  npm_config_cache: "$CI_PROJECT_DIR/.npm"

cache:
  key:
    files:
      - package-lock.json
  paths:
    - .npm/
    - node_modules/

# ──────────────────────────────────────────────────────────
# Validation: runs on every merge request
# ──────────────────────────────────────────────────────────
doc-validate:
  stage: validate
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == "main"
  script:
    - npm ci --prefer-offline
    - npx docgen validate --json > doc-report.json
    - |
      node -e "
        const report = JSON.parse(require('fs').readFileSync('doc-report.json', 'utf8'));
        console.log('Coverage: ' + report.coverage.overall + '% (threshold: ' + report.coverage.threshold + '%)');
        if (!report.coverage.passed) {
          console.error('FAILED: Coverage below threshold');
          process.exit(1);
        }
        const errors = (report.violations || []).filter(v => v.level === 'error');
        if (errors.length > 0) {
          console.error('FAILED: ' + errors.length + ' validation error(s)');
          process.exit(1);
        }
        console.log('Documentation validation passed');
      "
  artifacts:
    paths:
      - doc-report.json
    reports:
      codequality: doc-report.json
    expire_in: 7 days

# ──────────────────────────────────────────────────────────
# Generation: runs on main branch only
# ──────────────────────────────────────────────────────────
doc-generate:
  stage: generate
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
  needs:
    - job: doc-validate
      optional: true
  script:
    - npm ci --prefer-offline
    - npx docgen generate --format markdown html
  artifacts:
    paths:
      - docs/api/
      - docs-site/build/
    expire_in: 30 days

# ──────────────────────────────────────────────────────────
# Deploy: GitLab Pages (runs on main only)
# ──────────────────────────────────────────────────────────
pages:
  stage: deploy
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
  needs:
    - doc-generate
  script:
    - mkdir -p public
    - cp -r docs-site/build/* public/
  artifacts:
    paths:
      - public
```

---

## 3. Jenkins

The following declarative `Jenkinsfile` validates documentation coverage, generates output in multiple formats, archives the artifacts, and enforces a coverage threshold as a quality gate.

```groovy
// Jenkinsfile
pipeline {
    agent {
        docker {
            image 'node:20'
        }
    }

    options {
        timeout(time: 15, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    environment {
        npm_config_cache = "${WORKSPACE}/.npm"
    }

    stages {
        stage('Install') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Validate Documentation') {
            steps {
                sh 'npx docgen validate --json > doc-report.json'
                script {
                    def report = readJSON file: 'doc-report.json'
                    echo "Documentation Coverage: ${report.coverage.overall}%"
                    echo "Threshold: ${report.coverage.threshold}%"

                    if (!report.coverage.passed) {
                        unstable("Documentation coverage ${report.coverage.overall}% is below threshold ${report.coverage.threshold}%")
                    }

                    def errors = report.violations.findAll { it.level == 'error' }
                    if (errors.size() > 0) {
                        error("Found ${errors.size()} documentation validation error(s)")
                    }
                }
            }
        }

        stage('Generate Documentation') {
            steps {
                sh 'npx docgen generate --format markdown html'
            }
        }

        stage('Archive Artifacts') {
            steps {
                archiveArtifacts artifacts: 'doc-report.json', fingerprint: true
                archiveArtifacts artifacts: 'docs/api/**/*', fingerprint: true
                archiveArtifacts artifacts: 'docs-site/build/**/*', fingerprint: true, allowEmptyArchive: true
            }
        }

        stage('Coverage Threshold Check') {
            steps {
                script {
                    def report = readJSON file: 'doc-report.json'

                    // Hard-fail if coverage is critically low
                    if (report.coverage.overall < 50) {
                        error("Critical: Documentation coverage ${report.coverage.overall}% is below 50%")
                    }

                    // Mark unstable if below configured threshold
                    if (!report.coverage.passed) {
                        unstable("Documentation coverage ${report.coverage.overall}% is below threshold ${report.coverage.threshold}%")
                    }
                }
            }
        }
    }

    post {
        always {
            publishHTML(target: [
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'docs-site/build',
                reportFiles: 'index.html',
                reportName: 'API Documentation'
            ])
        }
        failure {
            echo 'Documentation pipeline failed. Check the doc-report.json artifact for details.'
        }
    }
}
```

---

## 4. Azure DevOps

The following `azure-pipelines.yml` integrates DocGen with Azure DevOps, running validation as a pull request policy and generating/publishing documentation on the main branch.

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include:
      - main

pr:
  branches:
    include:
      - main

pool:
  vmImage: 'ubuntu-latest'

variables:
  npm_config_cache: $(Pipeline.Workspace)/.npm

stages:
  # ────────────────────────────────────────────────────────
  # Stage 1: Validate documentation (runs on PR + main)
  # ────────────────────────────────────────────────────────
  - stage: Validate
    displayName: 'Validate Documentation'
    jobs:
      - job: DocValidate
        displayName: 'Documentation Coverage Check'
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '20.x'
            displayName: 'Install Node.js'

          - task: Cache@2
            inputs:
              key: 'npm | "$(Agent.OS)" | package-lock.json'
              path: $(npm_config_cache)
            displayName: 'Cache npm packages'

          - script: npm ci
            displayName: 'Install dependencies'

          - script: npx docgen validate --json > $(Build.ArtifactStagingDirectory)/doc-report.json
            displayName: 'Run documentation validation'

          - task: PublishBuildArtifacts@1
            inputs:
              PathtoPublish: '$(Build.ArtifactStagingDirectory)/doc-report.json'
              ArtifactName: 'doc-coverage-report'
            displayName: 'Publish coverage report'
            condition: always()

          - script: |
              node -e "
                const report = JSON.parse(require('fs').readFileSync('$(Build.ArtifactStagingDirectory)/doc-report.json', 'utf8'));

                // Write to pipeline summary
                console.log('##vso[task.setvariable variable=docCoverage]' + report.coverage.overall);

                if (!report.coverage.passed) {
                  console.log('##vso[task.logissue type=error]Documentation coverage ' + report.coverage.overall + '% is below threshold ' + report.coverage.threshold + '%');
                  console.log('##vso[task.complete result=Failed]Coverage below threshold');
                  process.exit(1);
                }

                const errors = (report.violations || []).filter(v => v.level === 'error');
                if (errors.length > 0) {
                  errors.forEach(e => {
                    console.log('##vso[task.logissue type=error]' + e.rule + ': ' + e.message);
                  });
                  console.log('##vso[task.complete result=Failed]Validation errors found');
                  process.exit(1);
                }

                console.log('Documentation validation passed at ' + report.coverage.overall + '%');
              "
            displayName: 'Enforce coverage threshold'

  # ────────────────────────────────────────────────────────
  # Stage 2: Generate and publish (main branch only)
  # ────────────────────────────────────────────────────────
  - stage: Generate
    displayName: 'Generate Documentation'
    dependsOn: Validate
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - job: DocGenerate
        displayName: 'Generate & Publish Docs'
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '20.x'
            displayName: 'Install Node.js'

          - task: Cache@2
            inputs:
              key: 'npm | "$(Agent.OS)" | package-lock.json'
              path: $(npm_config_cache)
            displayName: 'Cache npm packages'

          - script: npm ci
            displayName: 'Install dependencies'

          - script: npx docgen generate --format markdown html
            displayName: 'Generate documentation'

          - task: PublishBuildArtifacts@1
            inputs:
              PathtoPublish: 'docs/api'
              ArtifactName: 'markdown-docs'
            displayName: 'Publish Markdown docs'

          - task: PublishBuildArtifacts@1
            inputs:
              PathtoPublish: 'docs-site/build'
              ArtifactName: 'html-docs'
            displayName: 'Publish HTML docs'
```

---

## 5. Quality Gates

### Coverage Threshold Enforcement

DocGen supports documentation coverage thresholds through the `.docgen.yaml` configuration file and CLI overrides. The relevant configuration lives under the `validation.coverage` section.

**Configuration in `.docgen.yaml`:**

```yaml
validation:
  coverage:
    # Minimum required coverage percentage (0-100)
    threshold: 80

    # When true, docgen generate exits with code 1 if coverage is below threshold
    enforce: false

    # Glob patterns for items to exclude from coverage calculations
    exclude:
      - "**/internal/**"
      - "**/generated/**"
```

**`validation.coverage.threshold`** (number, default: `80`)

Sets the minimum documentation coverage percentage required. Any value between 0 and 100 is valid. When `docgen validate` runs, coverage is compared against this threshold to determine whether the check passes or fails.

**`validation.coverage.enforce`** (boolean, default: `false`)

Controls whether `docgen generate` enforces the coverage threshold. When set to `true`, the generate command exits with code 1 if documentation coverage falls below the threshold. This is distinct from `docgen validate`, which always exits with code 1 on threshold failure.

The enforcement logic in the generate command (from `packages/cli/src/commands/generate.ts`):

```typescript
// Exit with appropriate code
if (config.validation.coverage.enforce && !result.coverage.passed) {
  process.exit(1);
}
```

**`--threshold` CLI Override**

The `docgen validate` command accepts a `--threshold` flag that overrides the configured value for that run:

```bash
# Override the threshold for this run only
npx docgen validate --threshold 90
```

This is useful in CI pipelines where you want to enforce a stricter threshold without modifying the project configuration:

```yaml
# Stricter threshold for release branches
- name: Validate documentation (release standard)
  run: npx docgen validate --threshold 95 --json > doc-report.json
```

**Exit Code Behavior**

| Command              | Condition                         | Exit Code |
|----------------------|-----------------------------------|-----------|
| `docgen validate`    | Coverage below threshold          | `1`       |
| `docgen validate`    | Any violation at `error` level    | `1`       |
| `docgen validate`    | Coverage met, no errors           | `0`       |
| `docgen generate`    | `enforce: true` and coverage low  | `1`       |
| `docgen generate`    | `enforce: false` (default)        | `0`       |
| `docgen generate`    | Unrecoverable pipeline error      | `1`       |

### API Diff as PR Check

The `docgen diff` command compares the current documentation state against a base reference. This is useful for detecting breaking API changes in pull requests.

> **Note:** The diff command is currently in Phase 2 development. The planned interface is documented here for pipeline preparation.

**Planned usage:**

```bash
# Compare current docs against the main branch
npx docgen diff --base main --json
```

**Planned JSON output structure:**

```json
{
  "base": "main",
  "current": "HEAD",
  "changes": {
    "added": [
      { "type": "module", "name": "NewModule", "path": "src/new-module.ts" }
    ],
    "removed": [
      { "type": "member", "name": "OldClass.deprecatedMethod", "module": "OldModule" }
    ],
    "modified": [
      {
        "type": "member",
        "name": "UserService.getUser",
        "module": "UserService",
        "field": "parameters",
        "before": "(id: string)",
        "after": "(id: string, options?: GetUserOptions)"
      }
    ]
  },
  "coverageDelta": {
    "before": 82,
    "after": 78,
    "delta": -4
  },
  "breaking": true
}
```

**CI integration pattern:**

```yaml
- name: Check for breaking API changes
  run: |
    npx docgen diff --base origin/main --json > diff-report.json
    node -e "
      const diff = JSON.parse(require('fs').readFileSync('diff-report.json', 'utf8'));
      if (diff.breaking) {
        console.error('Breaking API changes detected');
        diff.changes.removed.forEach(c => console.error('  Removed: ' + c.name));
        process.exit(1);
      }
      if (diff.coverageDelta.delta < -5) {
        console.error('Coverage dropped by ' + Math.abs(diff.coverageDelta.delta) + '%');
        process.exit(1);
      }
      console.log('No breaking changes. Coverage delta: ' + diff.coverageDelta.delta + '%');
    "
```

### Freshness Checking

Stale documentation -- where source files have changed since the last documentation build -- can be detected by comparing file modification timestamps against the last generation time.

**Pattern: Timestamp comparison in CI**

```yaml
- name: Check documentation freshness
  run: |
    # Find the most recently modified source file
    LATEST_SOURCE=$(find src/ -name "*.ts" -newer docs/api/.generated-at 2>/dev/null | head -20)

    if [ -n "$LATEST_SOURCE" ]; then
      echo "::warning::Stale documentation detected. The following source files were modified after the last doc generation:"
      echo "$LATEST_SOURCE"
      echo ""
      echo "Run 'npx docgen generate' to update documentation."
      exit 1
    else
      echo "Documentation is up to date."
    fi
```

**Pattern: Generation timestamp marker**

Add a post-generation step that writes a marker file:

```yaml
- name: Generate documentation
  run: |
    npx docgen generate --format markdown html
    date -u +"%Y-%m-%dT%H:%M:%SZ" > docs/api/.generated-at
```

**Pattern: Git-based freshness check**

```yaml
- name: Check if docs need regeneration
  run: |
    # Get the last commit that touched documentation output
    LAST_DOC_COMMIT=$(git log -1 --format="%H" -- docs/api/)
    # Get commits that touched source since then
    CHANGED_SOURCE=$(git diff --name-only "$LAST_DOC_COMMIT"..HEAD -- 'src/**/*.ts' 'src/**/*.java' 'src/**/*.py')

    if [ -n "$CHANGED_SOURCE" ]; then
      echo "Source files changed since last doc generation:"
      echo "$CHANGED_SOURCE"
      echo "::warning::Documentation may be stale. Consider regenerating."
    fi
```

---

## 6. Monorepo Considerations

### Path-Based Triggers

In a monorepo, you should only regenerate documentation for packages whose source files actually changed. This avoids unnecessary builds and keeps pipeline times short.

**GitHub Actions with path filters:**

```yaml
# .github/workflows/docs-monorepo.yml
name: Documentation (Monorepo)

on:
  pull_request:
    branches: [main]
    paths:
      - 'packages/*/src/**'
      - '.docgen.yaml'

  push:
    branches: [main]
    paths:
      - 'packages/*/src/**'
      - '.docgen.yaml'

jobs:
  detect-changes:
    name: Detect Changed Packages
    runs-on: ubuntu-latest
    outputs:
      packages: ${{ steps.changes.outputs.packages }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Detect changed packages
        id: changes
        run: |
          if [ "${{ github.event_name }}" == "pull_request" ]; then
            BASE=${{ github.event.pull_request.base.sha }}
          else
            BASE=${{ github.event.before }}
          fi

          CHANGED_PACKAGES=$(git diff --name-only "$BASE"..HEAD -- 'packages/*/src/' | \
            sed 's|packages/\([^/]*\)/.*|\1|' | \
            sort -u | \
            jq -R -s -c 'split("\n") | map(select(length > 0))')

          echo "packages=$CHANGED_PACKAGES" >> "$GITHUB_OUTPUT"
          echo "Changed packages: $CHANGED_PACKAGES"

  doc-validate:
    name: Validate Docs (${{ matrix.package }})
    needs: detect-changes
    if: needs.detect-changes.outputs.packages != '[]'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: ${{ fromJson(needs.detect-changes.outputs.packages) }}
      fail-fast: false
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Validate package documentation
        working-directory: packages/${{ matrix.package }}
        run: npx docgen validate --json > doc-report.json

      - name: Upload package report
        uses: actions/upload-artifact@v4
        with:
          name: doc-report-${{ matrix.package }}
          path: packages/${{ matrix.package }}/doc-report.json
```

### Parallel Documentation Generation

When multiple packages change, generate their documentation in parallel and merge the results:

```yaml
  doc-generate:
    name: Generate Docs (${{ matrix.package }})
    needs: [detect-changes, doc-validate]
    if: github.ref == 'refs/heads/main' && needs.detect-changes.outputs.packages != '[]'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: ${{ fromJson(needs.detect-changes.outputs.packages) }}
      fail-fast: false
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Generate package documentation
        working-directory: packages/${{ matrix.package }}
        run: npx docgen generate --format markdown html

      - name: Upload generated docs
        uses: actions/upload-artifact@v4
        with:
          name: docs-${{ matrix.package }}
          path: |
            packages/${{ matrix.package }}/docs/api/
            packages/${{ matrix.package }}/docs-site/build/
```

### Composite Doc Site Assembly

After parallel generation, assemble the individual package outputs into a unified documentation site:

```yaml
  assemble-docs:
    name: Assemble Documentation Site
    needs: doc-generate
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download all doc artifacts
        uses: actions/download-artifact@v4
        with:
          pattern: docs-*
          path: artifacts/

      - name: Assemble composite site
        run: |
          mkdir -p site

          # Copy each package's docs into the combined site
          for pkg_dir in artifacts/docs-*/; do
            pkg_name=$(basename "$pkg_dir" | sed 's/^docs-//')
            echo "Assembling docs for: $pkg_name"

            # Markdown docs
            if [ -d "$pkg_dir/docs/api" ]; then
              mkdir -p "site/api/$pkg_name"
              cp -r "$pkg_dir/docs/api/"* "site/api/$pkg_name/"
            fi

            # HTML docs
            if [ -d "$pkg_dir/docs-site/build" ]; then
              mkdir -p "site/html/$pkg_name"
              cp -r "$pkg_dir/docs-site/build/"* "site/html/$pkg_name/"
            fi
          done

          echo "Composite site assembled:"
          find site -type f | head -50

      - name: Deploy composite site to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./site
```

---

## 7. JSON Output Schema

### `docgen validate --json`

The `docgen validate --json` command outputs a JSON object to stdout with the following structure. The process exits with code `1` when coverage is below the threshold or when any violation has `level: "error"`.

```json
{
  "coverage": {
    "overall": 82,
    "threshold": 80,
    "passed": true,
    "undocumented": [
      "UserService.internalHelper",
      "AuthModule.validateToken"
    ],
    "modules": [
      {
        "name": "UserService",
        "coverage": 90
      },
      {
        "name": "AuthModule",
        "coverage": 65
      }
    ]
  },
  "violations": [
    {
      "rule": "require-description",
      "level": "warn",
      "message": "Missing description for UserService.internalHelper"
    },
    {
      "rule": "require-param-docs",
      "level": "error",
      "message": "Missing parameter documentation for AuthModule.validateToken(token)"
    }
  ],
  "duration": 1243
}
```

**Field reference:**

| Field                          | Type       | Description |
|--------------------------------|------------|-------------|
| `coverage.overall`             | `number`   | Overall documentation coverage percentage (0-100) |
| `coverage.threshold`           | `number`   | Configured threshold from `.docgen.yaml` or `--threshold` |
| `coverage.passed`              | `boolean`  | Whether `overall >= threshold` |
| `coverage.undocumented`        | `string[]` | Fully qualified names of undocumented items |
| `coverage.modules`             | `array`    | Per-module coverage breakdown |
| `coverage.modules[].name`      | `string`   | Module name |
| `coverage.modules[].coverage`  | `number`   | Module-level coverage percentage |
| `violations`                   | `array`    | All rule violations found during validation |
| `violations[].rule`            | `string`   | Validation rule identifier (e.g., `require-description`) |
| `violations[].level`           | `string`   | Severity: `"error"` or `"warn"` |
| `violations[].message`         | `string`   | Human-readable violation description |
| `duration`                     | `number`   | Validation duration in milliseconds |

### `docgen generate --json`

The `docgen generate --json` command outputs a JSON summary of the generation run. The complete artifacts are written to disk according to the output configuration; only metadata is printed to stdout.

```json
{
  "success": true,
  "modules": 12,
  "artifacts": 24,
  "coverage": {
    "overall": 82,
    "threshold": 80,
    "passed": true
  },
  "duration": 4521
}
```

**Field reference:**

| Field                | Type      | Description |
|----------------------|-----------|-------------|
| `success`            | `boolean` | Whether the generation completed without errors |
| `modules`            | `number`  | Total number of modules parsed from source |
| `artifacts`          | `number`  | Total number of output files written |
| `coverage.overall`   | `number`  | Overall documentation coverage percentage |
| `coverage.threshold` | `number`  | Configured threshold |
| `coverage.passed`    | `boolean` | Whether coverage meets the threshold |
| `duration`           | `number`  | Total generation duration in milliseconds |

### JsonReporter Output

When using the `JsonReporter` (activated by the `--json` flag in the pipeline), the output follows this structure, which includes per-module detail with undocumented item lists:

```json
{
  "success": true,
  "stats": {
    "modulesTotal": 12,
    "membersTotal": 87,
    "coverageAverage": 82,
    "filesGenerated": 24,
    "totalTimeMs": 4521
  },
  "errors": [
    {
      "phase": "parse",
      "message": "Failed to parse src/broken.ts: Unexpected token at line 42"
    }
  ],
  "modules": [
    {
      "id": "user-service",
      "name": "UserService",
      "coverage": 90,
      "undocumented": ["internalHelper", "privateMethod"]
    },
    {
      "id": "auth-module",
      "name": "AuthModule",
      "coverage": 65,
      "undocumented": ["validateToken", "refreshSession"]
    }
  ]
}
```

**Field reference:**

| Field                       | Type       | Description |
|-----------------------------|------------|-------------|
| `success`                   | `boolean`  | Overall pipeline success |
| `stats.modulesTotal`        | `number`   | Number of modules parsed |
| `stats.membersTotal`        | `number`   | Number of members (functions, classes, etc.) parsed |
| `stats.coverageAverage`     | `number`   | Average documentation coverage across all modules |
| `stats.filesGenerated`      | `number`   | Number of output files produced |
| `stats.totalTimeMs`         | `number`   | Pipeline duration in milliseconds |
| `errors`                    | `array`    | Errors encountered during the pipeline |
| `errors[].phase`            | `string`   | Pipeline phase where the error occurred |
| `errors[].message`          | `string`   | Error description |
| `modules`                   | `array`    | Per-module breakdown |
| `modules[].id`              | `string`   | Module identifier |
| `modules[].name`            | `string`   | Module display name |
| `modules[].coverage`        | `number`   | Module documentation coverage percentage |
| `modules[].undocumented`    | `string[]` | List of undocumented member names in this module |
