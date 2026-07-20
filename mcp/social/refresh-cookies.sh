#!/bin/bash
#
# Extracts social media cookies from Firefox and writes them to .env
# Supports: LinkedIn (Voyager), Twitter/X
#
# Usage:
#   ./refresh-cookies.sh           — refresh all platforms
#   ./refresh-cookies.sh linkedin  — refresh LinkedIn only
#   ./refresh-cookies.sh twitter   — refresh Twitter only
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
FIREFOX_PROFILE="$HOME/Library/Application Support/Firefox/Profiles/3866ldmd.default-release-1716254547483"
COOKIE_DB="$FIREFOX_PROFILE/cookies.sqlite"
TMP_DB="/tmp/social-cookies-$$.sqlite"

if [ ! -f "$COOKIE_DB" ]; then
  echo "Error: Firefox cookie database not found at:"
  echo "  $COOKIE_DB"
  echo ""
  echo "If your Firefox profile path has changed, update FIREFOX_PROFILE in this script."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at:"
  echo "  $ENV_FILE"
  exit 1
fi

# Copy DB to avoid lock (Firefox holds it open)
cp "$COOKIE_DB" "$TMP_DB"

update_env() {
  local key="$1"
  local value="$2"
  local escaped_value
  escaped_value=$(printf '%s\n' "$value" | sed 's/[&/\]/\\&/g')
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i '' "s|^${key}=.*|${key}=${escaped_value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

PLATFORM="${1:-all}"
UPDATED=0
FAILED=0

# --- LinkedIn ---
if [ "$PLATFORM" = "all" ] || [ "$PLATFORM" = "linkedin" ]; then
  echo "LinkedIn:"

  LI_AT=$(sqlite3 "$TMP_DB" "SELECT value FROM moz_cookies WHERE host LIKE '%linkedin.com' AND name='li_at' ORDER BY expiry DESC LIMIT 1;")
  JSESSIONID=$(sqlite3 "$TMP_DB" "SELECT value FROM moz_cookies WHERE host LIKE '%linkedin.com' AND name='JSESSIONID' ORDER BY expiry DESC LIMIT 1;")
  LIDC=$(sqlite3 "$TMP_DB" "SELECT value FROM moz_cookies WHERE host LIKE '%linkedin.com' AND name='lidc' ORDER BY expiry DESC LIMIT 1;")
  BCOOKIE=$(sqlite3 "$TMP_DB" "SELECT value FROM moz_cookies WHERE host LIKE '%linkedin.com' AND name='bcookie' ORDER BY expiry DESC LIMIT 1;")

  # Strip quotes and prefixes
  JSESSIONID=$(echo "$JSESSIONID" | sed 's/^"//;s/"$//;s/^ajax://')
  BCOOKIE=$(echo "$BCOOKIE" | sed 's/^"//;s/"$//')
  LIDC=$(echo "$LIDC" | sed 's/^"//;s/"$//')

  # JSESSIONID is a session-only cookie (no expiry) so Firefox stores it in
  # memory, not cookies.sqlite. Prompt for manual paste from DevTools.
  if [ -z "$JSESSIONID" ] && [ -n "$LI_AT" ]; then
    echo "  JSESSIONID not in cookie DB (session-only)."
    echo "  → Open Firefox DevTools → Storage → Cookies → linkedin.com"
    echo "  → Copy the JSESSIONID value (e.g. ajax:1234567890123456789)"
    printf "  Paste JSESSIONID: "
    read -r JSESSIONID
    JSESSIONID=$(echo "$JSESSIONID" | sed 's/^"//;s/"$//;s/^ajax://')
    [ -n "$JSESSIONID" ] && echo "  JSESSIONID set successfully"
  fi

  LI_MISSING=""
  [ -z "$LI_AT" ] && LI_MISSING="$LI_MISSING li_at"
  [ -z "$JSESSIONID" ] && LI_MISSING="$LI_MISSING JSESSIONID"
  [ -z "$LIDC" ] && LI_MISSING="$LI_MISSING lidc"
  [ -z "$BCOOKIE" ] && LI_MISSING="$LI_MISSING bcookie"

  # lidc and bcookie are optional for Voyager — only li_at + JSESSIONID are required
  if [ -z "$LI_AT" ]; then
    echo "  Missing: li_at"
    echo "  → Log into linkedin.com in Firefox first"
    FAILED=1
  elif [ -z "$JSESSIONID" ]; then
    echo "  Missing: JSESSIONID (could not fetch)"
    echo "  → Try visiting linkedin.com/feed/ in Firefox, then retry"
    FAILED=1
  else
    update_env "LINKEDIN_LI_AT" "$LI_AT"
    update_env "LINKEDIN_JSESSIONID" "$JSESSIONID"
    [ -n "$LIDC" ] && update_env "LINKEDIN_LIDC" "$LIDC"
    [ -n "$BCOOKIE" ] && update_env "LINKEDIN_BCOOKIE" "$BCOOKIE"
    echo "  li_at:      ${#LI_AT} chars"
    echo "  JSESSIONID: $JSESSIONID"
    [ -n "$LIDC" ] && echo "  lidc:       ${#LIDC} chars"
    [ -n "$BCOOKIE" ] && echo "  bcookie:    ${#BCOOKIE} chars"
    UPDATED=1
  fi

  # Extract reaction queryId from Firefox browsing history
  PLACES_DB="$FIREFOX_PROFILE/places.sqlite"
  if [ -f "$PLACES_DB" ]; then
    TMP_PLACES="/tmp/social-places-$$.sqlite"
    cp "$PLACES_DB" "$TMP_PLACES"
    REACT_QID=$(sqlite3 "$TMP_PLACES" "SELECT url FROM moz_places WHERE url LIKE '%voyagerSocialDashReactions%' ORDER BY last_visit_date DESC LIMIT 1;" 2>/dev/null | grep -oE 'voyagerSocialDashReactions\.[a-f0-9]+')
    rm -f "$TMP_PLACES"
    if [ -n "$REACT_QID" ]; then
      update_env "LINKEDIN_REACT_QUERY_ID" "$REACT_QID"
      echo "  react qid:  $REACT_QID"
    fi
  fi
  echo ""
fi

# --- Twitter/X ---
if [ "$PLATFORM" = "all" ] || [ "$PLATFORM" = "twitter" ]; then
  echo "Twitter/X:"

  AUTH_TOKEN=$(sqlite3 "$TMP_DB" "SELECT value FROM moz_cookies WHERE (host LIKE '%x.com' OR host LIKE '%twitter.com') AND name='auth_token' ORDER BY expiry DESC LIMIT 1;")
  CT0=$(sqlite3 "$TMP_DB" "SELECT value FROM moz_cookies WHERE (host LIKE '%x.com' OR host LIKE '%twitter.com') AND name='ct0' ORDER BY expiry DESC LIMIT 1;")
  TWID=$(sqlite3 "$TMP_DB" "SELECT value FROM moz_cookies WHERE (host LIKE '%x.com' OR host LIKE '%twitter.com') AND name='twid' ORDER BY expiry DESC LIMIT 1;")
  GUEST_ID=$(sqlite3 "$TMP_DB" "SELECT value FROM moz_cookies WHERE (host LIKE '%x.com' OR host LIKE '%twitter.com') AND name='guest_id' ORDER BY expiry DESC LIMIT 1;")
  PERSONALIZATION_ID=$(sqlite3 "$TMP_DB" "SELECT value FROM moz_cookies WHERE (host LIKE '%x.com' OR host LIKE '%twitter.com') AND name='personalization_id' ORDER BY expiry DESC LIMIT 1;")
  CF_CLEARANCE=$(sqlite3 "$TMP_DB" "SELECT value FROM moz_cookies WHERE (host LIKE '%x.com' OR host LIKE '%twitter.com') AND name='cf_clearance' ORDER BY expiry DESC LIMIT 1;")

  TW_MISSING=""
  [ -z "$AUTH_TOKEN" ] && TW_MISSING="$TW_MISSING auth_token"
  [ -z "$CT0" ] && TW_MISSING="$TW_MISSING ct0"

  if [ -n "$TW_MISSING" ]; then
    echo "  Missing:$TW_MISSING"
    echo "  → Log into x.com in Firefox first"
    FAILED=1
  else
    update_env "TWITTER_AUTH_TOKEN" "$AUTH_TOKEN"
    update_env "TWITTER_CSRF_TOKEN" "$CT0"
    [ -n "$TWID" ] && update_env "TWITTER_TWID" "$TWID"
    [ -n "$GUEST_ID" ] && update_env "TWITTER_GUEST_ID" "$GUEST_ID"
    [ -n "$PERSONALIZATION_ID" ] && update_env "TWITTER_PERSONALIZATION_ID" "$PERSONALIZATION_ID"
    [ -n "$CF_CLEARANCE" ] && update_env "TWITTER_CF_CLEARANCE" "$CF_CLEARANCE"
    echo "  auth_token:    ${#AUTH_TOKEN} chars"
    echo "  ct0:           ${#CT0} chars"
    [ -n "$TWID" ] && echo "  twid:          ${#TWID} chars"
    [ -n "$GUEST_ID" ] && echo "  guest_id:      ${#GUEST_ID} chars"
    [ -n "$CF_CLEARANCE" ] && echo "  cf_clearance:  ${#CF_CLEARANCE} chars"
    UPDATED=1
  fi
  echo ""
fi

rm -f "$TMP_DB"

# --- Moddable (@ModdableGames) Twitter/X from Chrome ---
if [ "$PLATFORM" = "all" ] || [ "$PLATFORM" = "moddable" ]; then
  echo "Moddable (Chrome):"

  CHROME_DB="$HOME/Library/Application Support/Google/Chrome/Default/Cookies"
  if [ ! -f "$CHROME_DB" ]; then
    echo "  Chrome cookie database not found"
    FAILED=1
  else
    CHROME_COOKIES=$(python3 -c "
import subprocess, sqlite3, shutil, tempfile, os, re, json
from hashlib import pbkdf2_hmac
from Crypto.Cipher import AES

key_raw = subprocess.run(
    ['security', 'find-generic-password', '-s', 'Chrome Safe Storage', '-w'],
    capture_output=True, text=True
).stdout.strip()
if not key_raw:
    print(json.dumps({'error': 'No Keychain key'}))
    exit()

enc_key = pbkdf2_hmac('sha1', key_raw.encode('utf-8'), b'saltysalt', 1003, dklen=16)
chrome_db = os.path.expanduser('~/Library/Application Support/Google/Chrome/Default/Cookies')
tmp = tempfile.mktemp(suffix='.sqlite')
shutil.copy2(chrome_db, tmp)

conn = sqlite3.connect(tmp)
cursor = conn.execute(
    '''SELECT name, encrypted_value FROM cookies
       WHERE (host_key LIKE '%x.com' OR host_key LIKE '%twitter.com')
       AND name IN ('auth_token', 'ct0', 'twid', 'guest_id', 'personalization_id')''')

results = {}
for name, ev in cursor:
    if ev[:3] != b'v10': continue
    payload = ev[3:]
    cipher = AES.new(enc_key, AES.MODE_CBC, IV=b' ' * 16)
    decrypted = cipher.decrypt(payload)
    pad = decrypted[-1]
    if isinstance(pad, int) and 1 <= pad <= 16:
        decrypted = decrypted[:-pad]
    text = decrypted.decode('latin-1')
    val = None
    if name == 'auth_token':
        m = re.search(r'[0-9a-f]{40}', text)
        if m: val = m.group(0)
    elif name == 'ct0':
        m = re.search(r'[0-9a-f]{100,}', text)
        if m: val = m.group(0)
    elif name == 'twid':
        m = re.search(r'u%3D\d+', text)
        if m: val = m.group(0)
    elif name == 'guest_id':
        m = re.search(r'v1%3A\d+', text)
        if m: val = m.group(0)
    elif name == 'personalization_id':
        m = re.search(r'\"[^\"]+\"', text)
        if m: val = m.group(0)
    if val and (name not in results or len(val) > len(results[name])):
        results[name] = val

conn.close()
os.unlink(tmp)
print(json.dumps(results))
" 2>&1)

    MOD_AUTH=$(echo "$CHROME_COOKIES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('auth_token',''))")
    MOD_CT0=$(echo "$CHROME_COOKIES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ct0',''))")
    MOD_TWID=$(echo "$CHROME_COOKIES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('twid',''))")
    MOD_GUEST=$(echo "$CHROME_COOKIES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('guest_id',''))")
    MOD_PERS=$(echo "$CHROME_COOKIES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('personalization_id',''))")

    if [ -z "$MOD_AUTH" ] || [ -z "$MOD_CT0" ]; then
      echo "  Missing auth_token or ct0 from Chrome"
      echo "  → Log into x.com as @ModdableGames in Chrome first"
      FAILED=1
    else
      update_env "TWITTER_MODDABLE_AUTH_TOKEN" "$MOD_AUTH"
      update_env "TWITTER_MODDABLE_CSRF_TOKEN" "$MOD_CT0"
      [ -n "$MOD_TWID" ] && update_env "TWITTER_MODDABLE_TWID" "$MOD_TWID"
      [ -n "$MOD_GUEST" ] && update_env "TWITTER_MODDABLE_GUEST_ID" "$MOD_GUEST"
      [ -n "$MOD_PERS" ] && update_env "TWITTER_MODDABLE_PERSONALIZATION_ID" "$MOD_PERS"
      echo "  auth_token:    ${#MOD_AUTH} chars"
      echo "  ct0:           ${#MOD_CT0} chars"
      [ -n "$MOD_TWID" ] && echo "  twid:          ${#MOD_TWID} chars"
      [ -n "$MOD_GUEST" ] && echo "  guest_id:      ${#MOD_GUEST} chars"
      UPDATED=1
    fi
  fi
  echo ""
fi

if [ "$UPDATED" = "1" ]; then
  echo "Done. Restart Claude Code to pick up new cookies."
fi

if [ "$FAILED" = "1" ]; then
  exit 1
fi
