#!/bin/bash
# -----------------------------------------------
# Smoke Tests – prüft ob der Proxy erreichbar ist
# Aufruf: bash test.sh
# -----------------------------------------------

BASE_URL="https://proxy.nele-campus.org"
EXPORT_TOKEN="${EXPORT_TOKEN:-$(grep EXPORT_TOKEN .env 2>/dev/null | cut -d= -f2)}"
PASS=0
FAIL=0

ok()   { echo "  ✓ $1"; ((++PASS)); }
fail() { echo "  ✗ $1"; ((++FAIL)); }

echo ""
echo "Nelly Proxy – Smoke Tests"
echo "─────────────────────────"

# 1. Chat-Endpunkt antwortet
echo ""
echo "1. Chat-Endpunkt"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"smoke-test","messages":[{"role":"user","content":"Hallo"}]}')
[ "$RESPONSE" = "200" ] && ok "POST /api/chat → 200" || fail "POST /api/chat → $RESPONSE (erwartet 200)"

# 2. Export-Endpunkt: falscher Token → 403
echo ""
echo "2. Export-Endpunkt (Zugriffschutz)"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/export?token=falscher-token")
[ "$RESPONSE" = "403" ] && ok "GET /export?token=falsch → 403" || fail "GET /export?token=falsch → $RESPONSE (erwartet 403)"

# 3. Export-Endpunkt: richtiger Token → 200
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/export?token=$EXPORT_TOKEN")
[ "$RESPONSE" = "200" ] && ok "GET /export?token=richtig → 200" || fail "GET /export?token=richtig → $RESPONSE (erwartet 200)"

# Ergebnis
echo ""
echo "─────────────────────────"
echo "  $PASS bestanden, $FAIL fehlgeschlagen"
echo ""
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
