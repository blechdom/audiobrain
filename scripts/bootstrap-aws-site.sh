#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
stack_name="${AWS_STACK_NAME:-audiobrain-production}"
region="us-east-1"
domain="${DOMAIN_NAME:-audiobrain.org}"
domain="${domain%.}"
github_repository="${GITHUB_REPOSITORY:-blechdom/audiobrain}"
github_environment="${GITHUB_ENVIRONMENT:-production}"
github_oidc_subject="${GITHUB_OIDC_SUBJECT:-}"

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI v2 is required." >&2
  exit 1
fi

if [[ "$github_repository" != */* ]]; then
  echo "GITHUB_REPOSITORY must use owner/repository form." >&2
  exit 1
fi

if [[ -z "$github_oidc_subject" ]]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "GitHub CLI is required to resolve this repository's exact OIDC subject." >&2
    echo "Install and authenticate gh, or set GITHUB_OIDC_SUBJECT explicitly." >&2
    exit 1
  fi
  if ! github_subject_prefix="$(
    gh api \
      "repos/$github_repository/actions/oidc/customization/sub" \
      --jq .sub_claim_prefix
  )"; then
    echo "Could not resolve the GitHub OIDC subject prefix for $github_repository." >&2
    echo "Confirm gh authentication, or set GITHUB_OIDC_SUBJECT explicitly." >&2
    exit 1
  fi
  if [[ -z "$github_subject_prefix" || "$github_subject_prefix" = "null" ]]; then
    echo "GitHub returned an empty OIDC subject prefix for $github_repository." >&2
    exit 1
  fi
  github_environment_claim="${github_environment//:/%3A}"
  github_oidc_subject="${github_subject_prefix}:environment:${github_environment_claim}"
fi

aws_args=(--region "$region")
if [[ -n "${AWS_PROFILE:-}" ]]; then
  aws_args+=(--profile "$AWS_PROFILE")
fi

account_id="$(
  aws sts get-caller-identity \
    --query Account \
    --output text \
    "${aws_args[@]}"
)"

read -r hosted_zone_id hosted_zone_name hosted_zone_private < <(
  aws route53 list-hosted-zones-by-name \
    --dns-name "$domain." \
    --max-items 1 \
    --query "HostedZones[0].[Id,Name,Config.PrivateZone]" \
    --output text \
    "${aws_args[@]}"
)

hosted_zone_id="${hosted_zone_id#/hostedzone/}"
if [[ "$hosted_zone_name" != "$domain." || "$hosted_zone_private" != "False" ]]; then
  echo "No public Route 53 hosted zone named $domain was found in AWS account $account_id." >&2
  exit 1
fi

stack_exists="false"
if aws cloudformation describe-stacks \
  --stack-name "$stack_name" \
  "${aws_args[@]}" \
  >/dev/null 2>&1
then
  stack_exists="true"
  existing_site_url="$(aws cloudformation describe-stacks \
    --stack-name "$stack_name" \
    --query "Stacks[0].Outputs[?OutputKey=='SiteUrl'].OutputValue | [0]" \
    --output text "${aws_args[@]}")"
  if [[ "$existing_site_url" != "https://$domain" ]]; then
    echo "Stack $stack_name does not identify https://$domain as its SiteUrl; review ownership before updating." >&2
    exit 1
  fi
fi

if [[ "$stack_exists" = "false" ]]; then
  existing_records="$(
    aws route53 list-resource-record-sets \
      --hosted-zone-id "$hosted_zone_id" \
      --query "ResourceRecordSets[?((Name=='$domain.' || Name=='www.$domain.') && (Type=='A' || Type=='AAAA' || Type=='CNAME'))].[Name,Type]" \
      --output text \
      "${aws_args[@]}"
  )"
  if [[ -n "$existing_records" && "$existing_records" != "None" ]]; then
    echo "Existing apex/www records must be reviewed before CloudFormation can own them:" >&2
    echo "$existing_records" >&2
    echo "No AWS resources were changed." >&2
    exit 1
  fi
fi

provider_arn="$(
  aws iam list-open-id-connect-providers \
    --query "OpenIDConnectProviderList[?ends_with(Arn, '/token.actions.githubusercontent.com')].Arn | [0]" \
    --output text \
    "${aws_args[@]}"
)"
create_provider="false"
if [[ -z "$provider_arn" || "$provider_arn" = "None" ]]; then
  create_provider="true"
fi

cat <<SUMMARY
AWS account:       $account_id
Hosted zone:       $hosted_zone_id ($domain)
CloudFormation:    $stack_name in $region
Stack exists:      $stack_exists
GitHub deployer:   $github_repository / $github_environment
Create OIDC IdP:   $create_provider
OIDC subject:      $github_oidc_subject

This creates or updates S3, CloudFront, ACM, Route 53, and a least-privilege
GitHub deployment role. CloudFront and Route 53 can incur AWS charges.
SUMMARY

plan_args=()
if [[ "${1:-}" = "--plan" ]]; then
  plan_args+=(--no-execute-changeset)
elif [[ "${1:-}" != "--yes" ]]; then
  read -r -p "Type deploy to continue: " confirmation
  if [[ "$confirmation" != "deploy" ]]; then
    echo "No AWS resources were changed."
    exit 1
  fi
fi

aws cloudformation deploy \
  --stack-name "$stack_name" \
  --template-file "$repo_root/infra/site.yml" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  "${plan_args[@]}" \
  --parameter-overrides \
    "DomainName=$domain" \
    "HostedZoneId=$hosted_zone_id" \
    "GitHubOidcSubject=$github_oidc_subject" \
    "CreateGitHubOidcProvider=$create_provider" \
  "${aws_args[@]}"

if [[ "${1:-}" = "--plan" ]]; then
  echo "Change set prepared without execution. Review it in CloudFormation before running with --yes."
  exit 0
fi

output() {
  local key="$1"
  aws cloudformation describe-stacks \
    --stack-name "$stack_name" \
    --query "Stacks[0].Outputs[?OutputKey=='$key'].OutputValue | [0]" \
    --output text \
    "${aws_args[@]}"
}

role_arn="$(output GitHubDeployRoleArn)"
bucket="$(output SiteBucketName)"
distribution_id="$(output DistributionId)"

cat <<OUTPUTS

Infrastructure is ready.

Site bucket:       $bucket
Distribution ID:   $distribution_id
Deploy role:       $role_arn
Production URL:    https://$domain

Configure these GitHub repository variables:

  gh variable set AWS_ACCOUNT_ID --repo "$github_repository" --body "$account_id"
  gh variable set AWS_DEPLOY_ROLE_ARN --repo "$github_repository" --body "$role_arn"
  gh variable set AWS_SITE_BUCKET --repo "$github_repository" --body "$bucket"
  gh variable set AWS_CLOUDFRONT_DISTRIBUTION_ID --repo "$github_repository" --body "$distribution_id"

Then push the verified main branch to use the normal GitHub workflow.
For an explicitly requested local recovery publication:

  npm ci
  npm run build:deploy
  npm run check:storybook-dist
  AWS_STACK_NAME="$stack_name" AWS_PROFILE="${AWS_PROFILE:-}" ./scripts/deploy-aws-site.sh dist
OUTPUTS
