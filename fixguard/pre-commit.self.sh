#!/bin/bash
# Pre-commit guard for the self-hosted build tree.
python3 /root/fixguard/fixguard.py self-files /root/coin_catalog_v2/frontend
rc=$?
if [ $rc -ne 0 ]; then
  echo ""
  echo "COMMIT BLOCKED: this change would drop a known-fix marker from the self-hosted tree."
  echo "If intentional, update /root/fixguard/fix-markers.json in the same change."
  exit 1
fi
exit 0
