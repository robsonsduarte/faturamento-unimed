#!/bin/bash
# DuarteOS: Auto-save session marker to Redis on Stop
# Non-blocking — if Redis or Python unavailable, silently exits

if ! command -v python3 &> /dev/null; then
  exit 0
fi

if ! python3 -c "import redis" 2>/dev/null; then
  exit 0
fi

# Only save if REDIS_URL is configured
if [ -z "$REDIS_URL" ]; then
  exit 0
fi

python3 -c "
import redis, json, os, subprocess
from datetime import datetime, timezone

url = os.environ.get('REDIS_URL', 'redis://localhost:6379')
try:
    r = redis.from_url(url, decode_responses=True, socket_timeout=3)
    r.ping()
except:
    exit(0)

# Detect project
project = 'unknown'
if os.path.exists('package.json'):
    try:
        pkg = json.load(open('package.json'))
        project = pkg.get('name', project)
    except:
        pass
if project == 'unknown':
    project = os.path.basename(os.getcwd())

now = datetime.now(timezone.utc)
sid = f'sess_{now.strftime(\"%Y%m%d_%H%M%S\")}'
prefix = f'duarteos:{project}'

# Skip if a session was saved recently (within 5 min)
latest_id = r.get(f'{prefix}:session:latest')
if latest_id:
    raw = r.get(f'{prefix}:session:{latest_id}')
    if raw:
        data = json.loads(raw)
        updated = datetime.fromisoformat(data.get('updated_at', data['created_at']))
        if (now - updated).total_seconds() < 300:
            exit(0)

# Get git info
branch = ''
commit = ''
try:
    branch = subprocess.check_output(['git', 'branch', '--show-current'], text=True, timeout=3, stderr=subprocess.DEVNULL).strip()
    commit = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'], text=True, timeout=3, stderr=subprocess.DEVNULL).strip()
except:
    pass

session = {
    'id': sid,
    'project': project,
    'created_at': now.isoformat(),
    'updated_at': now.isoformat(),
    'status': 'auto-saved',
    'summary': f'Sessao encerrada automaticamente. Branch: {branch}, Commit: {commit}',
    'decisions': [],
    'pending_items': [],
    'files_modified': [],
    'errors_encountered': [],
    'context_notes': f'Auto-save via Stop hook. Branch: {branch}',
    'git_branch': branch,
    'git_last_commit': commit,
    'size_bytes': 0
}

data = json.dumps(session, ensure_ascii=False)
session['size_bytes'] = len(data.encode('utf-8'))
data = json.dumps(session, ensure_ascii=False)

r.set(f'{prefix}:session:{sid}', data, ex=604800)
r.set(f'{prefix}:session:latest', sid)

# Update index
idx_key = f'{prefix}:sessions:index'
idx = json.loads(r.get(idx_key) or '[]')
idx.insert(0, sid)
idx = idx[:50]
r.set(idx_key, json.dumps(idx))
" 2>/dev/null

exit 0
