#!/usr/bin/env bash
# Explicit publication only. This script never creates commits or force-pushes.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v gh >/dev/null
command -v node >/dev/null
gh auth status >/dev/null
npm test
npm run check
[[ "$(git rev-parse --show-toplevel)" == "$PWD" ]] || { echo 'Initialize this directory as its own git repository first.' >&2; exit 1; }
[[ "$(git branch --show-current)" == main ]] || { echo 'Switch to main before publishing.' >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Review and commit all changes before publishing.' >&2; exit 1; }
if gh api repos/bobuk-io/.github > /dev/null 2>&1; then
  visibility="$(gh api repos/bobuk-io/.github --jq .visibility)"
  [[ "$visibility" == public ]] || { echo 'The existing .github repository is not public. Refusing to change visibility.' >&2; exit 1; }
  origin="$(git remote get-url origin)"
  case "$origin" in
    https://github.com/bobuk-io/.github|https://github.com/bobuk-io/.github.git|git@github.com:bobuk-io/.github.git|ssh://git@github.com/bobuk-io/.github.git) ;;
    *) echo 'Unexpected origin; refusing to push.' >&2; exit 1 ;;
  esac
  git push -u origin main
else
  # An API/auth failure cannot overwrite an existing repository: create will fail.
  gh repo create bobuk-io/.github --public --source . --remote origin --push \
    --description 'Public organization overview for bobuk.io' --homepage 'https://bobuk.io/'
fi
printf '\nPublished: https://github.com/bobuk-io\n'
