# AudioBrain deployment design and source audit

Status: the AudioBrain application, AWS templates/scripts, CI workflow and deployment artifact checks are now implemented. [infra/README.md](../infra/README.md) is the current operating procedure. This document retains the original pre-build source audit from 2026-09-10 and its cutover requirements; historical environment observations below are not a fresh cloud inventory or a claim of publication.

## What was verified at the design baseline

- The local AudioBrain checkout is `/home/blechdom/creative/audiobrain`, with origin `git@github.com:blechdom/audiobrain.git` and no application files at the start of this audit.
- The connected GitHub integration confirms that `blechdom/audiobrain` is public, has `main` as its default branch, and is empty. Its repository contents endpoint explicitly returned “This repository is empty.”
- VideoBrain's checked-in infrastructure, scripts, package scripts, and workflow are available locally and were read. The descriptions below concern those files; they are not an independent audit of VideoBrain's running AWS account.
- The user reports that `audiobrain.org` is hosted on AWS and should use the same credentials and CI/publishing requirements as VideoBrain. The domain's account, hosted zone, existing resources, and current service have not been independently verified.

Read-only inspection limits: `aws` is not installed in this execution environment; `gh` is installed but has no CLI authentication. The connected GitHub integration can inspect repository metadata and contents, but its generic fetch tool rejected the workflow-list endpoint. A shell HTTPS probe could not resolve `audiobrain.org`; a separate web probe could not open it. These results do **not** prove that the user's AWS hosting or DNS registration is absent. No credentials, secret values, cloud resources, GitHub settings, or DNS records were changed or retrieved.

## Reuse from VideoBrain

| Area | Verified starting point | AudioBrain treatment |
| --- | --- | --- |
| Application | React, TypeScript, Vite, React Flow, Zustand, Zod, Lucide; Node.js 22 or newer | Reuse the stack and command conventions; retain one AudioBrain registry/compiler as the graph authority. |
| Component catalog | Storybook imports production components; static build lives under `dist/storybook` | Publish AudioBrain controls, nodes, graph presets, and performance surfaces at `/storybook/`. |
| Validation | ESLint, TypeScript, Vitest, Playwright Chromium, production build and artifact checks | Preserve these gates; add meaningful audio/runtime and performance-layout coverage. |
| Hosting | CloudFormation, private encrypted/versioned S3, CloudFront Origin Access Control, ACM, Route 53 | Adapt the template to AudioBrain resources after inventorying the existing site. |
| Region | Stack and CloudFront certificate use `us-east-1` | Use the same region requirement for an equivalent stack. |
| Authentication | GitHub OIDC assumes a content-publishing role | Reuse the account's OIDC provider where present, with a distinct AudioBrain role and repository trust. |
| Publication | Non-HTML assets first, HTML last, CloudFront invalidation, public smoke tests | Keep the ordering, retain old hashed assets, and wait for public validation before calling a release complete. |
| Recovery | Bucket retained on stack deletion; overwritten/deleted object versions retained for 30 days | Preserve these protections and record a reproducible release/rollback procedure. |

Sources: [package scripts and dependencies](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/package.json), [agent guide](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/AGENTS.md), [infrastructure overview](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/infra/README.md), [CloudFormation template](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/infra/site.yml), [publishing workflow](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/.github/workflows/deploy-aws.yml), [local deployment script](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/scripts/deploy-aws-site.sh).

“Same credentials” means reusing the user's authorized AWS bootstrap identity and GitHub authentication where available. It does not mean copying a VideoBrain production role, bucket identifier, distribution identifier, OIDC subject, or long-lived access key into AudioBrain. The deployment pipeline uses short-lived credentials, with no required GitHub AWS access-key secrets.

## Target configuration matrix

| Setting | AudioBrain target | Evidence/status |
| --- | --- | --- |
| Repository | `blechdom/audiobrain` | Verified through connected GitHub metadata and local origin. |
| Default branch | `main` | Verified through GitHub metadata. |
| Production URL | `https://audiobrain.org` | User-specified; current hosting unverified. |
| Canonical alias | `www.audiobrain.org` redirects to apex | Proposed parity with VideoBrain; inspect existing DNS first. |
| Stack name | `audiobrain-production` | Proposed; existing stack/name unknown. |
| Stack region | `us-east-1` | Required by the inherited template's certificate/CloudFront arrangement. |
| Public hosted zone | Exact public zone for `audiobrain.org` | Account, zone identifier, delegation, and records unknown. |
| Production environment | `production`, deployment restricted to `main` | Proposed; current environment settings unverified. |
| `AWS_ACCOUNT_ID` | Verified intended AWS account | Value unknown; nonsecret repository variable. |
| `AWS_DEPLOY_ROLE_ARN` | Role scoped to AudioBrain publication | Value unknown; nonsecret repository variable. |
| `AWS_SITE_BUCKET` | AudioBrain site bucket | Value unknown; nonsecret repository variable. |
| `AWS_CLOUDFRONT_DISTRIBUTION_ID` | Distribution serving AudioBrain | Value unknown; nonsecret repository variable. |
| Exact OIDC subject | AudioBrain repository + `production` environment claim | Must resolve from the repository's OIDC configuration; do not derive it from VideoBrain's subject. |
| Account-global GitHub OIDC provider | Reuse if already present | Existence unverified. |
| `AWS_PROFILE` | User's authenticated bootstrap profile | Optional local selector; availability/name unverified here. |
| `AWS_STACK_NAME`, `DOMAIN_NAME`, `GITHUB_REPOSITORY`, `GITHUB_ENVIRONMENT` | AudioBrain defaults in adapted scripts | Proposed script configuration, not secrets. |
| `GITHUB_OIDC_SUBJECT` | Explicit override only if needed for actual configured subject | Optional bootstrap input; exact value must be verified. |
| `AWS_REGION`, `DRY_RUN` | Region selection; preview publication without uploads/invalidation | Preserve local deployment script controls. |

The inherited [bootstrap script](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/scripts/bootstrap-aws-site.sh) resolves `actions/oidc/customization/sub`, reads `.sub_claim_prefix`, and appends the environment claim. Its role trust also checks the OIDC audience. Retain exact subject verification: renaming a project in a workflow is insufficient to authorize a different repository.

## Repository deliverables — implemented locally

These files have now been adapted inside AudioBrain with AudioBrain identities and validation:

- `infra/site.yml` and `infra/README.md` for the target site's resources and operating procedure.
- `scripts/bootstrap-aws-site.sh` and `scripts/deploy-aws-site.sh`, with AudioBrain defaults and existing-record safeguards.
- `.github/workflows/deploy-aws.yml`, with AudioBrain artifact, concurrency, role-session, production URL, and smoke-test targets.
- `scripts/check-storybook-artifact.mjs`, checking AudioBrain's actual production catalog entries rather than VideoBrain-specific story IDs.
- `tests/aws-deployment.test.ts`, covering private origins, role scope, repository trust, correct domain, publication ordering, and headers.

Do not carry over a hard-coded VideoBrain OIDC default. Either require the verified subject as a template parameter or set an AudioBrain value only after repository configuration is inspected. Preserve the user's existing website until the ownership and cutover plan are concrete.

## Staged implementation and rollout

### 1. Build and validate locally

Create the AudioBrain application, graph contracts, three teaching presets, and performance-layout components before preparing a production publication. Match these commands to the inherited tooling:

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build:deploy
npm run check:storybook-dist
npm run test:e2e
git diff --check
```

VideoBrain's `npm run verify` additionally builds and smoke-tests its MCP server. AudioBrain should include those checks once an AudioBrain MCP implementation exists, and should define `verify` around real implemented artifacts from the first commit. A command that refers to an absent copied server is not a useful gate.

Acceptance: Shapes, L-Systems, and Graphs presets load without devices; an explicit Start Audio action starts output; mute/stop works; patch changes dispose audio/device resources; edit/performance views address the same saved controls; reloading an exported project preserves its graph and performance layout. Use deterministic fake MIDI/microphone/gateway devices in CI and Storybook, plus offline audio checks for the implemented synthesis/control behavior.

### 2. Inventory the existing AWS site

Once the AWS CLI and an authorized identity are available, read the caller account, public hosted zone and delegation, apex/`www` records, CloudFormation ownership, CloudFront aliases/origins/headers, certificate names/status, bucket settings, and GitHub OIDC provider. Inspect GitHub production environment restrictions, variable names/values for nonsecret identifiers, and the exact OIDC subject configuration.

Acceptance: each target in the matrix is filled from evidence; existing DNS/resource ownership and rollback destinations are recorded. If AudioBrain already has a serving distribution, decide whether to update its owning stack, import supported resources into a managed stack, or provision a parallel origin/distribution and cut over. Do not run the inherited bootstrap blindly: on a new stack it deliberately refuses existing apex or `www` address records.

### 3. Adapt infrastructure and prepare the change

Produce an AudioBrain-specific CloudFormation change set or equivalent reviewable diff against the verified existing deployment. Reuse the account-global OIDC provider where it exists. Scope the new routine role to the AudioBrain bucket and distribution; provisioning permissions remain with the bootstrap identity.

Acceptance: the proposed changes identify any replacement, retained resource, DNS change, or temporary parallel resource; no VideoBrain resource identifier is a deployment target. Confirm the production environment's branch restriction and the four repository variables point to the same intended stack/account.

### 4. Preserve the verified CI flow

The intended workflow is:

1. On pull requests to `main`, pushes to `main`, and manual dispatch, check out with persisted credentials disabled and install Node.js 22 with npm caching.
2. Run `npm ci`, `npm run verify`, `npm run build:deploy`, and Chromium browser tests.
3. Require `dist/index.html`, `dist/storybook/index.html`, `dist/storybook/iframe.html`, and `dist/storybook/index.json`; validate the AudioBrain catalog manifest.
4. Upload the complete `dist` as `audiobrain-site` with a seven-day workflow artifact retention period, matching VideoBrain.
5. Deploy only after verification, only from `main` outside a pull request, with all four AWS variables configured, through the `production` environment. Give this job `id-token: write`; the rest of the workflow keeps read-only repository permissions.
6. Assume the AudioBrain role through OIDC in `us-east-1`, with the expected account identifier enforced.
7. Check CloudFront header configuration, publish non-HTML assets with five-minute revalidation, then publish HTML with immediate revalidation. Retain old hashed assets; do not add a broad `--delete` sync.
8. Invalidate `/*`, wait for completion, then run public acceptance checks. Keep deployment concurrency serialized as in VideoBrain.

First-publication detail: VideoBrain's inherited preflight performs a successful HTTP check of `/` **before** uploading files. A brand-new empty private bucket can return an error there and prevent its first CI publication. Adapt this deliberately: either use an already-serving verified site or add a first-publication preflight that accepts the expected empty-origin status while still checking the required headers. The post-publication checks must still require successful app/catalog responses. Do not leave deployment permanently skipped merely because the AWS variables have not been configured; report that as “verified, deployment not configured.”

### 5. Public acceptance

Verify `https://audiobrain.org/`, `/storybook/`, `/storybook/iframe.html`, and `/storybook/index.json`, plus the `www` redirect, content type, and scoped framing policies. Add a browser check loading each preset and its performance view on the production origin. Check that compiled worker/worklet assets return executable JavaScript with appropriate MIME types, if present in the implementation. Confirm microphone/MIDI lifecycle behavior on supported hardware during a deliberate manual smoke test; physical devices must not be required for the automated gate.

Acceptance: both `verify` and `deploy` are successful, invalidation is complete, the published commit is identifiable, the three presets are available, and public performance controls affect the expected graph parameters. HTTP 200 alone is insufficient to establish working audio.

## AudioBrain-specific hosting decisions

| Concern | Consequence for the inherited deployment |
| --- | --- |
| Performance mode and fullscreen | Can remain an in-app layout on the root document. If implementation adds direct `/perform/...` routes, add explicit route handling or use hash routing: the inherited CloudFront function only resolves directory indexes and the Storybook redirect. |
| Audio/device start | The static app must preserve explicit user activation and capability feedback. The current template permits same-origin microphone/camera access through Permissions-Policy; review any additional MIDI/output-device policy against the implemented browser APIs. |
| VideoBrain interoperability | `audiobrain.org` and `videobrain.org` are different origins. The inherited app response sets `X-Frame-Options: DENY`; it cannot provide cross-site embedded performance controls without an intentional header/embedding contract. Share protocol data through the selected bridge; do not assume iframe or cross-origin browser-channel access works automatically. |
| OSC and remote sessions | S3/CloudFront serve static assets. Any OSC UDP adapter, WebSocket relay, authentication service, or session server needs a separately defined service deployment. It is optional to the permission-free, local-first application. |
| AudioWorklet and workers | Package their assets into the same tested release artifact and verify public loading. A downloaded HTML shell does not prove the audio runtime module is available. |
| Shared-memory optimization | The inherited template has no COOP/COEP isolation headers. If a future design chooses shared memory, make isolation a deliberate compatibility decision and test Storybook, media loading, and bridges; do not require it merely to use ordinary Web Audio nodes. |
| Storybook | Preserve the dedicated `/storybook/*` behavior with `SAMEORIGIN` framing and `frame-ancestors 'self'`; main app framing policy remains separately specified. |

These are implementation constraints inferred from the checked-in CloudFront/template behavior and the proposed AudioBrain features, rather than claims that these features are already deployed.

## Rollback and recovery

- Record the release commit, artifact identity, target bucket/distribution, and known-good public checks for every release. Keep an immutable copy or manifest of a release if recovery must outlast the inherited seven-day CI artifact retention.
- For an application regression, revert the faulty change on `main` and allow the normal verify/deploy pipeline to rebuild and republish the known-good behavior. Do not describe re-running an arbitrary old workflow as guaranteed rollback: the inherited deployment condition only permits the `main` ref.
- For an emergency artifact restoration, restore a complete previously verified release using a deliberate recovery workflow or explicitly authorized recovery operation; assets still precede HTML, invalidation is awaited, and public checks are repeated. Versioned S3 objects can assist recovery within the configured retention period.
- For a DNS or infrastructure regression, use the recorded previous target and the owning stack's change history. Application object rollback does not reverse a distribution alias, certificate, or DNS change.
- Retaining the bucket on stack deletion protects content; it does not keep a deleted distribution or removed DNS record serving traffic. The account-global OIDC provider is retained because other repositories may rely on it.

The original pre-build analysis performed no cloud bootstrap, DNS change or publication. The implementation now includes a real workflow and deployment scripts; a release still requires authenticated target verification, a successful pipeline and public acceptance. See the current operational status in [infra/README.md](../infra/README.md).
