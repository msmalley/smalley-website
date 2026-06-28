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
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i '' "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
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
  # memory, not cookies.sqlite. If li_at exists, fetch JSESSIONID via curl.
  if [ -z "$JSESSIONID" ] && [ -n "$LI_AT" ]; then
    echo "  JSESSIONID not in cookie DB (session-only), fetching via li_at..."
    JSESSIONID=$(curl -sI -b "li_at=$LI_AT" "https://www.linkedin.com/voyager/api/me" 2>/dev/null \
      | grep -i 'set-cookie.*JSESSIONID' \
      | sed 's/.*JSESSIONID=//;s/;.*//' \
      | sed 's/^"//;s/"$//;s/^ajax://')
    if [ -z "$JSESSIONID" ]; then
      # Fallback: extract from response headers of a simple page load
      JSESSIONID=$(curl -sI -b "li_at=$LI_AT" -L "https://www.linkedin.com/feed/" 2>/dev/null \
        | grep -i 'set-cookie.*JSESSIONID' \
        | sed 's/.*JSESSIONID=//;s/;.*//' \
        | sed 's/^"//;s/"$//;s/^ajax://')
    fi
    [ -n "$JSESSIONID" ] && echo "  JSESSIONID fetched successfully"
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

if [ "$UPDATED" = "1" ]; then
  echo "Done. Restart Claude Code to pick up new cookies."
fi

if [ "$FAILED" = "1" ]; then
  exit 1
fi
