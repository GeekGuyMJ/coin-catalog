#!/bin/bash
# Pre-push guard for the public repo.
# 1) Fixguard: the pushed tree must still contain every known-fix marker.
# 2) Root-absolute asset paths stay blocked (existing rule).
python3 /root/fixguard/fixguard.py check-public-repo /root/coin-catalog-public
rc=$?
if [ $rc -ne 0 ]; then
  echo ""
  echo "PUSH BLOCKED: this push would revert a previously-shipped fix."
  echo "If you INTENTIONALLY re-implemented a fix, update /root/fixguard/fix-markers.json in the same change."
  exit 1
fi
exit 0
