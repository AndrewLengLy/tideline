#!/usr/bin/env bash
# Final copy check from the build prompt. Scans every text-bearing file for banned words and
# patterns. Code tokens that share a spelling with a banned word are allowlisted below, and
# everything else must be rewritten. Lockfile and saved API responses are skipped.
set -uo pipefail
cd "$(dirname "$0")/.."

FILES=$(git ls-files --cached --others --exclude-standard 2>/dev/null | grep -vE '^(package-lock\.json|AGENTS\.md|CLAUDE\.md|tests/fixtures/|scripts/copy-check\.sh$|docs/check-sources)' | grep -E '\.(tsx?|mts|mjs|md|mdx|txt|json|css|ya?ml)$')

PATTERN='—|rather than|instead of|not just|not only|whether you|allowing|ensuring|helping you|making it easier|additionally|furthermore|moreover|it'"'"'s worth noting|it'"'"'s important to remember|in short|ultimately|at the end of the day|great question|let'"'"'s dive|in today'"'"'s|less about|far from being|\bleverag|\bdelve|seamless|\brobust|landscape|\brealm\b|tapestry|testament to|\bunlock|\belevate|\bempower|\btransform(s|ed|ing|ative)?\b|supercharg|game-changer|fast-paced'

# Code tokens that share a spelling with a banned word.
ALLOW='\.transform\b|"transform"|transform\.|elevation'

HITS=$(echo "$FILES" | xargs grep -nIiE "$PATTERN" 2>/dev/null | grep -viE "$ALLOW" || true)
# Colon-then-reveal: a short label, a colon, then one or two capitalized words ending the sentence.
REVEAL=$(echo "$FILES" | grep -E '\.(tsx|md|txt)$' | xargs grep -nIE '>[^<{]{1,40}: [A-Z][a-z]+( [a-z]+)?\.<' 2>/dev/null || true)
# Banned typography: uppercase eyebrow styling and letter-spaced labels.
EYEBROW=$(echo "$FILES" | grep -E '\.(tsx|css)$' | xargs grep -nIE '\buppercase\b|tracking-widest|tracking-wider|text-transform' 2>/dev/null || true)

if [ -n "$HITS$REVEAL$EYEBROW" ]; then
  echo "Copy check found banned words or patterns:"
  [ -n "$HITS" ] && echo "$HITS"
  [ -n "$REVEAL" ] && echo "$REVEAL"
  [ -n "$EYEBROW" ] && echo "$EYEBROW"
  exit 1
fi
echo "Copy check passed: no banned words, em dashes, colon reveals, or eyebrow styles in $(echo "$FILES" | wc -l | tr -d ' ') files."
