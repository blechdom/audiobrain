# AudioBrain on AWS

The implementation follows VideoBrain's deployment stack: React/Vite assets and
Storybook on a private, encrypted, versioned S3 origin behind CloudFront, ACM,
Route 53 and a content-only GitHub OIDC role. Production is intended to be
`https://audiobrain.org`, with `www` redirecting to the apex and the component
catalog at `/storybook/`. The dedicated `audiobrain-production` stack is configured in AWS account `642815508926`, and the GitHub production environment is restricted to `main`. Publication is verified by the workflow and public acceptance checks.

## Configure the existing site

Use the same authorized bootstrap identity as VideoBrain; never use its bucket,
distribution or repository trust as AudioBrain's target. AWS CLI authentication uses the `audiobrain` profile. GitHub CLI authentication uses `gh auth login --hostname github.com --git-protocol ssh --web`; older CLI versions do not accept `--skip-ssh-key`. An authenticated inventory must identify the existing domain, public hosted zone, records, stack, distribution and certificate before any cutover.

The template uses `us-east-1` for the stack and CloudFront certificate. The
account-global GitHub OIDC provider is reused when present. The required
`GitHubOidcSubject` template parameter has no default: the bootstrap script reads
the repository's actual subject prefix from GitHub, appends its environment
claim, or accepts an explicitly verified `GITHUB_OIDC_SUBJECT`.

After inventory confirms the resources and intended ownership, prepare an
unexecuted CloudFormation change set:

```sh
AWS_PROFILE=your-existing-profile ./scripts/bootstrap-aws-site.sh --plan
```

Review the change set and any replacements. Execute the exact reviewed change set using `aws cloudformation execute-change-set --stack-name audiobrain-production --change-set-name <reviewed-change-set> --region us-east-1 --profile audiobrain`. A direct bootstrap without a preceding plan can use `./scripts/bootstrap-aws-site.sh --yes` when authorized. The script refuses to
create a stack over existing apex or `www` address records. An existing stack
must identify this exact domain in its `SiteUrl` output. Updating an existing
site with different ownership requires an explicit resource import or cutover
plan; the script does not override the safeguards.

Create a GitHub `production` environment restricted to `main`, and configure the
four repository variables from the verified AudioBrain stack outputs:

| Variable | Source |
| --- | --- |
| `AWS_ACCOUNT_ID` | Intended authenticated AWS account |
| `AWS_DEPLOY_ROLE_ARN` | `GitHubDeployRoleArn` stack output |
| `AWS_SITE_BUCKET` | `SiteBucketName` stack output |
| `AWS_CLOUDFRONT_DISTRIBUTION_ID` | `DistributionId` stack output |

These are identifiers. CI uses short-lived OIDC credentials. No long-lived AWS
access-key secrets are required. The routine role can publish/read site objects,
inspect its bucket and invalidate its distribution; it cannot provision resources.

## Verification and publication

```sh
npm ci
npm run verify
npm run build:deploy
npm run check:storybook-dist
npm run test:e2e
```

Pushes to `main` publish only after all verification gates pass. Pull requests
run the same verification. Missing AWS variables produce an explicit “verified;
deployment not configured” workflow summary. They do not claim successful deployment.

CI and the local deployment script use the same publication sequence:

1. Validate the app and actual Storybook catalog in the complete artifact.
2. Require separate CloudFront policies: app framing denied; Storybook allows
   same-origin frames. The preflight accepts 403/404 on an empty initial origin,
   still requires both header policies, and rejects server failures.
3. Publish non-HTML assets first with five-minute revalidation; publish HTML
   last with immediate revalidation. Retain old hashed assets.
4. Invalidate `/*` and wait for completion.
5. Require successful app/catalog responses, actual catalog entries, the app's
   referenced JavaScript with executable MIME type, `build.json` release identity
   matching the CI commit, framing policies and `www`
   redirect. CI additionally runs browser acceptance against the public origin.

For an explicitly requested local recovery or dry-run preview:

```sh
DRY_RUN=true AWS_PROFILE=your-existing-profile ./scripts/deploy-aws-site.sh dist
AWS_PROFILE=your-existing-profile ./scripts/deploy-aws-site.sh dist
```

No artifact argument builds the complete site first. `AWS_STACK_NAME` defaults
to `audiobrain-production`; `AWS_REGION` defaults to `us-east-1`. Explicit
`AWS_SITE_BUCKET` and `AWS_CLOUDFRONT_DISTRIBUTION_ID` override stack lookup.
`SITE_URL` defaults to the intended public origin. Browser tests use a dedicated
local server on port 5178, or an explicit `PLAYWRIGHT_BASE_URL` with no local server.

## Recovery and capability boundaries

The bucket and shared OIDC provider are retained on stack deletion. Versioning
keeps overwritten objects for 30 days; workflow artifacts are retained for seven
days. Reverting a faulty main-branch commit runs the normal pipeline again.
Retaining objects does not preserve traffic if DNS or the distribution is removed.
Record the previous DNS target before an infrastructure change. The public
`/build.json` identifies the app version and source commit. Vite also supplies
`__APP_VERSION__` and `__COMMIT_SHA__` constants to production components.

Audio start and device permission remain explicit user actions. The site is
static: an optional OSC UDP/WebSocket adapter needs a separate service. Cross-origin
VideoBrain embedding is not enabled by these policies. The UI and audio engine
use ordinary Web Audio without requiring shared-memory isolation headers.
