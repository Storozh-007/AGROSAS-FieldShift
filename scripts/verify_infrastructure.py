#!/usr/bin/env python3
"""Verify persistence and backup restore without replacing the application database."""
import json
import os
import shutil
import subprocess
import time
import urllib.request
from pathlib import Path

root=Path(__file__).resolve().parents[1]
os.chdir(root)
docker=shutil.which('docker') or '/Applications/Docker.app/Contents/Resources/bin/docker'
os.environ['PATH']=str(Path(docker).parent)+os.pathsep+os.environ.get('PATH','')
compose=[docker,'compose','--env-file','.runtime/prod.env','-f','compose.yaml','-f','compose.prod.yaml']
def run(*args,**kwargs):return subprocess.run([*compose,*args],check=True,**kwargs)
def get(path):
    with urllib.request.urlopen('http://localhost:8080'+path,timeout=20) as response:return json.load(response)
before=get('/api/fields')
subprocess.run(['./fieldshift','backup'],check=True)
archive=max((root/'backups').glob('fieldshift-prod-*.dump'),key=lambda p:p.stat().st_mtime_ns)
db='restore_verify_'+str(time.time_ns())
run('exec','-T','database','createdb','-U','fieldshift',db)
try:
    with archive.open('rb') as stream:
        run('exec','-T','database','pg_restore','-U','fieldshift','-d',db,'--no-owner','--no-acl','--exit-on-error',stdin=stream)
    count=run('exec','-T','database','psql','-U','fieldshift','-d',db,'-Atc','SELECT count(*) FROM fields',capture_output=True,text=True).stdout.strip()
    assert int(count)==len(before),(count,len(before))
    run('exec','-T','database','psql','-U','fieldshift','-d',db,'-c','SELECT PostGIS_Version();')
    print(f'PASS: backup restored to an isolated database, {count} fields retained')
finally:
    run('exec','-T','database','dropdb','-U','fieldshift',db)
subprocess.run(['./fieldshift','stop'],check=True)
subprocess.run(['./fieldshift','start'],check=True)
after=get('/api/fields')
assert sorted(before,key=lambda f:f['id'])==sorted(after,key=lambda f:f['id'])
print(f'PASS: stop/start retained all {len(after)} field records, including their geometry')
