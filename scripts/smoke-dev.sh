#!/usr/bin/env bash
# Runtime smoke: starts `bun run dev` on a temp DB and drives the API and every page over real HTTP (mock AI, no network needed).
set -euo pipefail
set -m # own process group, so the EXIT trap kills next and its children

cd "$(dirname "$0")/.."
PORT=${PORT:-3123}
TMP=$(mktemp -d)
LOG=$TMP/dev.log
JAR=$TMP/jar
B=http://localhost:$PORT

unset GEMINI_API_KEY
export PORT DB_PATH=$TMP/smoke.sqlite

bun run dev >"$LOG" 2>&1 &
pid=$!
trap 'kill -- -$pid 2>/dev/null || true' EXIT

for _ in $(seq 90); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "$B/login" || true)" = 200 ] && break
  sleep 1
done

# check <label> <expected status> <curl args...>; the response body lands in $TMP/body
check() {
  local label=$1 want=$2; shift 2
  local got
  got=$(curl -s -o "$TMP/body" -w '%{http_code}' -b "$JAR" -c "$JAR" "$@" || true)
  if [ "$got" != "$want" ]; then
    echo "FAIL $label: want $want, got $got"; cat "$TMP/body"; echo; echo "--- dev log ($LOG)"; tail -30 "$LOG"; exit 1
  fi
  echo "ok   $label ($got)"
}
json() { check "$1" "$2" -X "$3" -H 'Content-Type: application/json' -d "$5" "$B$4"; }

check "GET /login" 200 "$B/login"
check "GET /register" 200 "$B/register"
check "GET /articles without session redirects" 307 "$B/articles"
check "GET /api/feeds without session" 401 "$B/api/feeds"

json "register" 201 POST /api/auth/register '{"email":"smoke@example.com","password":"smoke-pass-123"}'
check "me" 200 "$B/api/auth/me"
json "logout" 200 POST /api/auth/logout '{}'
check "me after logout" 401 "$B/api/auth/me"
json "login" 200 POST /api/auth/login '{"email":"smoke@example.com","password":"smoke-pass-123"}'

json "create feed" 201 POST /api/feeds '{"name":"Smoke","url":"https://feed.invalid/rss","icon":"📰"}'
id=$(grep -o '"id":[0-9]*' "$TMP/body" | head -1 | cut -d: -f2)
json "unsubscribe" 200 PATCH "/api/feeds/$id" '{"subscribed":false}'
json "subscribe + rename" 200 PATCH "/api/feeds/$id" '{"subscribed":true,"name":"X"}'
check "list feeds" 200 "$B/api/feeds"
check "articles (unreachable feed -> errors, not 500)" 200 "$B/api/articles"
check "article proxy refuses internal target" 400 "$B/api/article?url=http://169.254.169.254/"
json "summary (mock)" 200 POST /api/ai/summary '{"url":"https://example.com/a","title":"Titel","content":"<p>Eins. Zwei. Drei. Vier.</p>"}'
grep -q '"summary":"Eins' "$TMP/body" || { echo "FAIL summary body: $(cat "$TMP/body")"; exit 1; }
check "clusters" 200 "$B/api/ai/clusters"
check "get settings" 200 "$B/api/settings"
json "put settings" 200 PUT /api/settings '{"theme":"dark","speed":3}'

for p in /articles "/articles/view?url=http%3A%2F%2F169.254.169.254%2F" /feeds /stories /settings /row-runner; do
  check "page $p" 200 "$B$p"
done

check "delete feed" 204 -X DELETE "$B/api/feeds/$id"
echo "smoke ok"
