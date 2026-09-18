#!/bin/bash
# Nuvia dev-server watchdog: restarts `bun run dev` whenever port 3000 stops responding.
while true; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 http://localhost:3000 || true)
  if [ "$CODE" != "200" ]; then
    # Reap any zombie dev processes then start fresh
    pkill -f "next dev" 2>/dev/null || true
    sleep 1
    cd /home/z/my-project
    setsid nohup bun run dev >> /home/z/my-project/dev.log 2>&1 < /dev/null &
    sleep 15
  fi
  sleep 20
done
