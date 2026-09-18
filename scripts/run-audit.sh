#!/bin/bash
# Full UI audit across all 20 modules — run after setting viewport + login.
# Usage: bash scripts/run-audit.sh <tag>   (results → /tmp/audit-<tag>.jsonl)
TAG="${1:-run}"
OUT="/tmp/audit-${TAG}.jsonl"
: > "$OUT"
MODULES=(Dashboard "Period Tracker" "Hormone IQ" Symptoms "PCOS Care" Fertility Pregnancy Menopause "AI Coach" "Diet Advisor" "Find Doctor" "Mind & Soul" "Move & Flow" "Skin & Beauty" "Wellness Market" Community Reports "AI Insights" "Go Premium" Settings)
for M in "${MODULES[@]}"; do
  SW=$(agent-browser eval "$(sed "s/__LABEL__/$M/" /home/z/my-project/scripts/ui-switch.js)" 2>&1 | tail -1)
  sleep 1.2   # allow data fetch + charts to render
  RES=$(agent-browser eval "$(cat /home/z/my-project/scripts/ui-audit.js)" 2>&1 | tail -1)
  echo "{\"module\":\"$M\",\"switch\":$SW,\"audit\":$RES}" >> "$OUT"
  # compact console line
  PROB=$(echo "$RES" | python3 -c "
import sys, json
try:
  d = json.loads(sys.stdin.read())
  if isinstance(d, str): d = json.loads(d)
  p = []
  if d.get('issues'): p += d['issues']
  if d.get('pokes'): p += ['POKE x%d' % len(d['pokes'])]
  if d.get('clipped'): p += ['CLIP x%d' % len(d['clipped'])]
  if d.get('unreachable'): p += ['UNREACH x%d' % d['unreachable']]
  print((' | '.join(p)) if p else 'OK')
except Exception as e: print('PARSE-FAIL ' + str(e))
")
  echo "[$M] $PROB"
done
echo "=== done → $OUT"
