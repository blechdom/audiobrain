#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
site_url="${SITE_URL:-https://audiobrain.org}"
site_url="${site_url%/}"
artifact_dir="$(mktemp -d)"
trap 'rm -rf "$artifact_dir"' EXIT
mkdir -p "$artifact_dir/storybook"
fetch() {
  curl --fail --silent --show-error --retry 8 --retry-all-errors --retry-delay 5 "$@"
}
fetch "$site_url/" --output "$artifact_dir/index.html"
fetch "$site_url/build.json" --output "$artifact_dir/build.json"
node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const metadata = JSON.parse(readFileSync(process.argv[1], "utf8"));
  if (metadata.app !== "audiobrain" || typeof metadata.version !== "string" ||
      typeof metadata.commit !== "string") throw new Error("Invalid AudioBrain release metadata");
  if (process.env.EXPECTED_COMMIT_SHA && metadata.commit !== process.env.EXPECTED_COMMIT_SHA)
    throw new Error("Published commit differs from the verified release artifact");
  console.log("Published AudioBrain " + metadata.version + " (" + metadata.commit + ")");
' "$artifact_dir/build.json"
for file in index.html iframe.html index.json; do
  fetch "$site_url/storybook/$file" --output "$artifact_dir/storybook/$file"
done
node "$repo_root/scripts/check-storybook-artifact.mjs" "$artifact_dir/storybook"
grep -qE '<title>AudioBrain[^<]*</title>' "$artifact_dir/index.html"
fetch --head "$site_url/" | grep -iqE '^content-type:.*text/html'
fetch --head "$site_url/storybook/" | grep -iqE '^content-type:.*text/html'
SITE_URL="$site_url" bash "$repo_root/scripts/check-cloudfront.sh"
# A compiled application must publish its referenced JS, not just the HTML shell.
entry_asset="$(node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const html = readFileSync(process.argv[1], "utf8");
  const asset = html.match(/<script[^>]*src="([^\"]+\.js)"/);
  if (!asset) process.exit(1);
  console.log(asset[1]);
' "$artifact_dir/index.html")"
fetch --head "$site_url$entry_asset" | grep -iqE '^content-type:.*(javascript|ecmascript)'
if [[ "$site_url" = "https://audiobrain.org" ]]; then
  fetch --head https://www.audiobrain.org/ | grep -iqE '^location:[[:space:]]*https://audiobrain.org/'
fi
echo "Public AudioBrain app, entry asset, catalog, and policies verified."
