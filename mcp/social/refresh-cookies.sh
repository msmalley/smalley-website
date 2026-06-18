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

  LI_MISSING=""
  [ -z "$LI_AT" ] && LI_MISSING="$LI_MISSING li_at"
  [ -z "$JSESSIONID" ] && LI_MISSING="$LI_MISSING JSESSIONID"
  [ -z "$LIDC" ] && LI_MISSING="$LI_MISSING lidc"
  [ -z "$BCOOKIE" ] && LI_MISSING="$LI_MISSING bcookie"

  if [ -n "$LI_MISSING" ]; then
    echo "  Missing:$LI_MISSING"
    echo "  → Log into linkedin.com in Firefox first"
    FAILED=1
  else
    update_env "LINKEDIN_LI_AT" "$LI_AT"
    update_env "LINKEDIN_JSESSIONID" "$JSESSIONID"
    update_env "LINKEDIN_LIDC" "$LIDC"
    update_env "LINKEDIN_BCOOKIE" "$BCOOKIE"
    echo "  li_at:      ${#LI_AT} chars"
    echo "  JSESSIONID: $JSESSIONID"
    echo "  lidc:       ${#LIDC} chars"
    echo "  bcookie:    ${#BCOOKIE} chars"
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
    echo "  auth_token: ${#AUTH_TOKEN} chars"
    echo "  ct0:        ${#CT0} chars"
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
