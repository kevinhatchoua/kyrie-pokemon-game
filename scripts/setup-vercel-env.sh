#!/usr/bin/env bash
# Usage: ./scripts/setup-vercel-env.sh 'https://xxx.supabase.co' 'anon-key'
set -euo pipefail
cd "$(dirname "$0")/.."

URL="${1:-}"
KEY="${2:-}"

if [[ -z "$URL" || -z "$KEY" ]]; then
  echo "Usage: $0 SUPABASE_URL SUPABASE_ANON_KEY"
  exit 1
fi

for env in production preview development; do
  npx vercel env add SUPABASE_URL "$env" --value "$URL" --yes --force
  npx vercel env add SUPABASE_ANON_KEY "$env" --value "$KEY" --yes --force
done

echo "Redeploying production…"
npx vercel --prod --yes

echo "Done. Open https://kyrie-pokemon-game.vercel.app and confirm 🟢 Live on the host screen."
