#!/usr/bin/env bash
set -euo pipefail

# During first publication an empty private S3 origin responds 403/404. Check
# those responses' policies too, but never accept an outage or wrong policy.
site_url="${SITE_URL:-https://audiobrain.org}"
site_url="${site_url%/}"
root_headers="$(mktemp)"
storybook_headers="$(mktemp)"
trap 'rm -f "$root_headers" "$storybook_headers"' EXIT

root_status="$(curl --silent --show-error --head --output "$root_headers" \
  --write-out '%{http_code}' --retry 4 --retry-all-errors --retry-delay 2 "$site_url/")"
case "$root_status" in
  200|403|404) ;;
  *) echo "CloudFront preflight failed: root returned HTTP $root_status" >&2; exit 1 ;;
esac
storybook_status="$(curl --silent --show-error --head --output "$storybook_headers" \
  --write-out '%{http_code}' --retry 4 --retry-all-errors --retry-delay 2 \
  "$site_url/storybook/__cloudfront-policy-probe__")"
case "$storybook_status" in
  200|403|404) ;;
  *) echo "CloudFront preflight failed: catalog probe returned HTTP $storybook_status" >&2; exit 1 ;;
esac

grep -iqE '^x-frame-options:[[:space:]]*DENY[[:space:]]*$' "$root_headers"
grep -iqE '^x-frame-options:[[:space:]]*SAMEORIGIN[[:space:]]*$' "$storybook_headers"
grep -iqE "^content-security-policy:[[:space:]]*frame-ancestors[[:space:]]+'self'[[:space:]]*$" "$storybook_headers"
echo "Verified CloudFront policies (root $root_status, catalog probe $storybook_status)."
