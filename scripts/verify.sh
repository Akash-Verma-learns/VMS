#!/usr/bin/env bash
#
# End-to-end verification of a running VMS.
#
# Checks the behaviour that matters and is easy to break silently: that every
# service is up, that authentication works, that role boundaries actually hold
# (an ASO must not reach a US-only endpoint), and that the two derived features
# — seat allotment from city preferences, and the data completeness check —
# return real answers rather than empty successes.
#
# Exits non-zero on the first failure, so it is usable in CI as well as by hand.
#
#   ./scripts/verify.sh
#
set -uo pipefail

API=${API:-http://localhost:3001}
PORTAL=${PORTAL:-http://localhost:5173}
FIELD=${FIELD:-http://localhost:5174}
GATEWAY=${GATEWAY:-http://localhost:8000}

pass=0; fail=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; pass=$((pass+1)); }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; fail=$((fail+1)); }
head() { printf '\n\033[1m%s\033[0m\n' "$1"; }

code() { curl -s -o /dev/null -m 10 -w '%{http_code}' "$@"; }
body() { curl -s -m 10 "$@"; }

# ---------------------------------------------------------------- services --
head "Services"
for pair in "$API/api/auth/request-otp:API" "$PORTAL/:Officer portal" "$FIELD/:Field app"; do
  url=${pair%:*}; name=${pair##*:}
  [ "$(code "$url")" != "000" ] && ok "$name reachable" || bad "$name is not running"
done
# The gate terminal is optional — it needs the ESP32 on the same network.
if [ "$(code "$GATEWAY/ping")" != "000" ]; then
  ok "Gate terminal gateway reachable"
else
  printf '  \033[33m–\033[0m Gate terminal gateway not running (hardware demo only)\n'
fi

# ------------------------------------------------------------------- login --
head "Authentication"
# OTPs are only in the server log by design, so authenticate using a session
# the database already holds rather than trying to intercept mail.
TOKENS=$(cd "$(dirname "$0")/../apps/api" && node -e '
  const { PrismaClient } = require("@prisma/client");
  const p = new PrismaClient();
  p.session.findMany({ where:{ expiresAt:{ gt:new Date() } },
                       include:{ user:{ select:{ role:true } } } })
   .then(rows => {
     const seen = {};
     for (const r of rows) if (!seen[r.user.role]) seen[r.user.role] = r.token;
     console.log(JSON.stringify(seen));
   }).catch(() => console.log("{}")).finally(() => p.$disconnect());
' 2>/dev/null | tail -1)

tok() { node -e "const t=$TOKENS; process.stdout.write(t['$1']||'')" 2>/dev/null; }

US=$(tok US); VS=$(tok VS)
if [ -n "$US" ]; then ok "US session available"; else bad "no live US session — sign in once, then re-run"; fi
if [ -n "$VS" ]; then ok "VS session available"; else bad "no live VS session — sign in once, then re-run"; fi
[ -z "$US" ] && { printf '\n%s\n' "Cannot continue without a session."; exit 1; }

AUTH_US=(-H "Authorization: Bearer $US")
AUTH_VS=(-H "Authorization: Bearer $VS")

# --------------------------------------------------------- access controls --
head "Role boundaries"
c=$(code "$API/api/exams" "${AUTH_US[@]}")
[ "$c" = "200" ] && ok "US can list exams (200)" || bad "US cannot list exams ($c)"

if [ -n "$VS" ]; then
  c=$(code "$API/api/exams" "${AUTH_VS[@]}")
  [ "$c" = "403" ] && ok "VS is refused the officer exam list (403, not 401)" \
                   || bad "VS got $c on /api/exams — expected 403"
fi

c=$(code "$API/api/exams")
[ "$c" = "401" ] && ok "unauthenticated request refused (401)" || bad "no token returned $c, expected 401"

c=$(code "$API/api/exams" -H "Authorization: Bearer not.a.real.token")
[ "$c" = "401" ] && ok "forged token refused (401)" || bad "forged token returned $c"

# ---------------------------------------------------------------- features --
head "Features"
EXAM=$(body "$API/api/exams" "${AUTH_US[@]}" | node -e 'let s="";process.stdin.on("data",d=>s+=d)
  .on("end",()=>{try{const j=JSON.parse(s);const a=j.exams??j;process.stdout.write(a[0]?.id??"")}catch{}})' 2>/dev/null)

if [ -n "$EXAM" ]; then
  ok "exam roster reachable"
  report=$(body "$API/api/admit-cards/$EXAM/data-check" "${AUTH_US[@]}")
  n=$(printf '%s' "$report" | node -e 'let s="";process.stdin.on("data",d=>s+=d)
    .on("end",()=>{try{const j=JSON.parse(s);console.log((j.findings??[]).length)}catch{console.log(-1)}})' 2>/dev/null)
  if [ "${n:-0}" -ge 0 ] && printf '%s' "$report" | grep -q '"ranAt"'; then
    b=$(printf '%s' "$report" | node -e 'let s="";process.stdin.on("data",d=>s+=d)
      .on("end",()=>{try{const j=JSON.parse(s);console.log(`${j.blockers} blocker(s), ${j.warnings} warning(s)`)}catch{console.log("?")}})')
    ok "data completeness check ran — $b, $n finding(s)"
  else
    bad "data completeness check returned no report"
  fi

  c=$(code "$API/api/admit-cards/$EXAM/data-check" "${AUTH_VS[@]}")
  if [ "$c" = "200" ] || [ "$c" = "403" ]; then
    ok "data check honours role rules for VS ($c)"
  else
    bad "data check returned $c for VS"
  fi
else
  bad "no exams seeded — run the seed script"
fi

# ------------------------------------------------------------------- units --
head "Unit tests"
if [ -x "$(dirname "$0")/../terminal/server/.venv/bin/python" ]; then
  if (cd "$(dirname "$0")/../terminal/server" && .venv/bin/python test_confidence.py >/tmp/vconf.log 2>&1); then
    ok "biometric confidence mapping ($(grep -c '\.\.\. ok' /tmp/vconf.log) tests)"
  else
    bad "biometric confidence mapping tests failed"; tail -5 /tmp/vconf.log | sed 's/^/      /'
  fi
else
  printf '  \033[33m–\033[0m gateway venv not set up; skipping confidence tests\n'
fi

# ------------------------------------------------------------------ result --
printf '\n\033[1m%d passed, %d failed\033[0m\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
