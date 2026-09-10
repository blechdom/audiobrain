#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
artifact_arg="${1:-dist}"
if [[ "$artifact_arg" = /* ]]; then
  artifact_dir="$(realpath -m "$artifact_arg")"
else
  artifact_dir="$(realpath -m "$repo_root/$artifact_arg")"
fi
stack_name="${AWS_STACK_NAME:-audiobrain-production}"
region="${AWS_REGION:-us-east-1}"
dry_run="${DRY_RUN:-false}"

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI v2 is required." >&2
  exit 1
fi

if [[ $# -eq 0 ]]; then
  (
    cd "$repo_root"
    npm run build:deploy
  )
elif [[ ! -d "$artifact_dir" ]]; then
  echo "Artifact directory does not exist: $artifact_dir" >&2
  echo "Build the complete deployable site first with: npm run build:deploy" >&2
  exit 1
fi

if [[ ! -f "$artifact_dir/index.html" ]]; then
  echo "Artifact is incomplete: missing index.html in $artifact_dir" >&2
  exit 1
fi

if [[ ! -f "$artifact_dir/build.json" ]]; then
  echo "Artifact is incomplete: missing build.json release identity" >&2
  exit 1
fi

for required_storybook_file in index.html iframe.html index.json; do
  if [[ ! -f "$artifact_dir/storybook/$required_storybook_file" ]]; then
    echo "Artifact is incomplete: missing storybook/$required_storybook_file" >&2
    echo "Build the complete deployable site first with: npm run build:deploy" >&2
    exit 1
  fi
done
node "$repo_root/scripts/check-storybook-artifact.mjs" "$artifact_dir/storybook"

aws_args=(--region "$region")
if [[ -n "${AWS_PROFILE:-}" ]]; then
  aws_args+=(--profile "$AWS_PROFILE")
fi

stack_output() {
  local key="$1"
  aws cloudformation describe-stacks \
    --stack-name "$stack_name" \
    --query "Stacks[0].Outputs[?OutputKey=='$key'].OutputValue | [0]" \
    --output text \
    "${aws_args[@]}"
}

bucket="${AWS_SITE_BUCKET:-}"
distribution_id="${AWS_CLOUDFRONT_DISTRIBUTION_ID:-}"

if [[ -z "$bucket" ]]; then
  bucket="$(stack_output SiteBucketName)"
fi
if [[ -z "$distribution_id" ]]; then
  distribution_id="$(stack_output DistributionId)"
fi

if [[ -z "$bucket" || "$bucket" = "None" ]]; then
  echo "Could not resolve the site bucket from AWS_SITE_BUCKET or stack $stack_name." >&2
  exit 1
fi
if [[ -z "$distribution_id" || "$distribution_id" = "None" ]]; then
  echo "Could not resolve the CloudFront distribution ID." >&2
  exit 1
fi

sync_args=(
  s3 sync
  "$artifact_dir/"
  "s3://$bucket/"
  --exclude "*.html"
  --only-show-errors
  --cache-control "public,max-age=300,must-revalidate"
)
html_args=(
  s3 cp
  "$artifact_dir/"
  "s3://$bucket/"
  --recursive
  --exclude "*"
  --include "*.html"
  --only-show-errors
  --cache-control "public,max-age=0,must-revalidate"
)
if [[ "$dry_run" = "true" ]]; then
  sync_args+=(--dryrun)
  html_args+=(--dryrun)
fi

if [[ "$dry_run" != "true" ]]; then
  bash "$repo_root/scripts/check-cloudfront.sh"
fi

echo "Publishing $artifact_dir to s3://$bucket"
aws "${sync_args[@]}" "${aws_args[@]}"
aws "${html_args[@]}" "${aws_args[@]}"

if [[ "$dry_run" = "true" ]]; then
  echo "Dry run complete; CloudFront was not invalidated."
  exit 0
fi

invalidation_id="$(
  aws cloudfront create-invalidation \
    --distribution-id "$distribution_id" \
    --paths "/*" \
    --query "Invalidation.Id" \
    --output text \
    "${aws_args[@]}"
)"

echo "Published site; waiting for CloudFront invalidation $invalidation_id"
aws cloudfront wait invalidation-completed \
  --distribution-id "$distribution_id" \
  --id "$invalidation_id" \
  "${aws_args[@]}"
bash "$repo_root/scripts/smoke-production.sh"
