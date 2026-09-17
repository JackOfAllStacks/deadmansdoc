#!/usr/bin/env bash
# End-to-end auth checks against a running server on $BASE. Never prints secrets.
set -u
BASE=${BASE:-http://localhost:3000}
DIR=$(mktemp -d)
JAR="$DIR/jar"
CODE=$(grep -E '^SIGNUP_ACCESS_CODE=' .env.local | cut -d= -f2-)
EMAIL="e2e-$(date +%s)@example.test"
PASS="correct-horse-battery"
pass=0; fail=0
check() { # name expected actual
  if [ "$2" = "$3" ]; then echo "PASS  $1 ($3)"; pass=$((pass+1)); else echo "FAIL  $1 (expected $2, got $3)"; fail=$((fail+1)); fi
}
code_of() { curl -s -o "$DIR/body" -w "%{http_code}" "$@"; }
loc_of() { curl -s -o /dev/null -w "%{redirect_url}" "$@"; }
signup() { # extra curl args...
  code_of -X POST "$BASE/api/auth/sign-up/email" -H "Origin: $BASE" -H "Content-Type: application/json" \
    -d "{\"name\":\"E2E Tester\",\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" "$@"
}

check "landing page public" 200 "$(code_of "$BASE/")"
check "health public" 200 "$(code_of "$BASE/api/health")"
check "home redirects when signed out" 307 "$(code_of "$BASE/home")"
check "  ...to sign-in with next" "$BASE/sign-in?next=%2Fhome" "$(loc_of "$BASE/home")"
check "sign-in page public" 200 "$(code_of "$BASE/sign-in")"

check "sign-up without code rejected" 400 "$(signup)"
check "sign-up with wrong code rejected" 400 "$(signup -H 'x-signup-code: nope')"
grep -q "access code" "$DIR/body" && check "  ...with a readable message" yes yes || check "  ...with a readable message" yes no
check "sign-up with short password rejected" 400 "$(code_of -X POST "$BASE/api/auth/sign-up/email" -H "Origin: $BASE" -H "Content-Type: application/json" -H "x-signup-code: $CODE" -d "{\"name\":\"E2E\",\"email\":\"short-$EMAIL\",\"password\":\"short\"}")"
echo "(waiting out the 3-per-10s auth rate limit)"; sleep 11
check "sign-up with right code" 200 "$(signup -H "x-signup-code: $CODE" -c "$JAR")"

check "home works when signed in" 200 "$(code_of -b "$JAR" "$BASE/home")"
sed "s/<!-- -->//g" "$DIR/body" | grep -q "Welcome, E2E Tester" && check "home greets user" yes yes || check "home greets user" yes no
check "sign-in page bounces signed-in user" "$BASE/home" "$(loc_of -b "$JAR" "$BASE/sign-in")"
check "open redirect blocked" "$BASE/home" "$(loc_of -b "$JAR" "$BASE/sign-in?next=//evil.example")"
check "safe next honoured" "$BASE/home?x=1" "$(loc_of -b "$JAR" "$BASE/sign-in?next=%2Fhome%3Fx%3D1")"

check "sign-out" 200 "$(code_of -X POST "$BASE/api/auth/sign-out" -H "Origin: $BASE" -H "Content-Type: application/json" -d '{}' -b "$JAR" -c "$JAR")"
check "home redirects after sign-out" 307 "$(code_of -b "$JAR" "$BASE/home")"

sleep 11
check "sign-in wrong password" 401 "$(code_of -X POST "$BASE/api/auth/sign-in/email" -H "Origin: $BASE" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"wrong-password-x\"}")"
check "sign-in right password" 200 "$(code_of -X POST "$BASE/api/auth/sign-in/email" -H "Origin: $BASE" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" -c "$JAR")"
check "home works after sign-in" 200 "$(code_of -b "$JAR" "$BASE/home")"

# A cookie that looks right but isn't a real session: the proxy lets it through,
# requireSession must send it to sign-in, and sign-in must render (no loop).
FAKE="$DIR/fake"; printf 'localhost\tFALSE\t/\tFALSE\t0\tbetter-auth.session_token\tforged.value\n' > "$FAKE"
check "forged cookie: home redirects" "$BASE/sign-in" "$(loc_of -b "$FAKE" "$BASE/home")"
check "forged cookie: sign-in renders" 200 "$(code_of -b "$FAKE" "$BASE/sign-in")"

sleep 11
XEMAIL="x-$EMAIL"
r=$(code_of -X POST "$BASE/api/auth/sign-up/email" -H 'Origin: https://evil.example' -H "Content-Type: application/json" -H "x-signup-code: $CODE" -d "{\"name\":\"X\",\"email\":\"$XEMAIL\",\"password\":\"$PASS\"}")
case "$r" in 403|404) check "cross-origin sign-up rejected" rejected rejected ;; *) check "cross-origin sign-up rejected" rejected "$r" ;; esac
check "  ...and no account was created" 401 "$(code_of -X POST "$BASE/api/auth/sign-in/email" -H "Origin: $BASE" -H "Content-Type: application/json" -d "{\"email\":\"$XEMAIL\",\"password\":\"$PASS\"}")"

sleep 11
for i in 1 2 3 4; do last=$(code_of -X POST "$BASE/api/auth/sign-in/email" -H "Origin: $BASE" -H "Content-Type: application/json" -d '{"email":"nobody@example.test","password":"wrong-password-x"}'); done
check "rate limit kicks in on 4th rapid sign-in" 429 "$last"
echo "E2E_EMAIL=$EMAIL"
echo "RESULT: $pass passed, $fail failed"
rm -rf "$DIR"
