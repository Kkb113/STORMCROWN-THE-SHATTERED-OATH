"""Boot and play the generated static build over HTTP. Run after npm run build."""
import json
import os
from pathlib import Path
import subprocess
import time
import traceback
from urllib.request import urlopen
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results/build-browser'
OUT.mkdir(parents=True, exist_ok=True)
report = {'checks': [], 'errors': [], 'network_errors': [], 'scope': 'Generated dist HTTP/WebGL startup, controls and persistent checkpoint smoke test.'}

def record(name, value=True):
    if not value:
        raise AssertionError(name)
    report['checks'].append(name)
    print('PASS', name, flush=True)

server_log = (OUT / 'server.log').open('w')
server = subprocess.Popen(['node', 'tools/serve.mjs', '--dist'], cwd=ROOT,
                          stdout=server_log, stderr=subprocess.STDOUT,
                          env={**os.environ, 'PORT': '4179'})
try:
    for _ in range(100):
        if server.poll() is not None:
            raise RuntimeError('Static-build server exited; see server.log')
        try:
            with urlopen('http://127.0.0.1:4179/build.json', timeout=1) as response:
                report['build'] = json.load(response)
                break
        except OSError:
            time.sleep(.1)
    else:
        raise RuntimeError('Static-build server did not become ready')
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        page = browser.new_page(viewport={'width': 1280, 'height': 720})
        page.set_default_timeout(30000)
        page.on('pageerror', lambda error: report['errors'].append(str(error)))
        page.on('console', lambda message: report['errors'].append(message.text) if message.type == 'error' else None)
        page.on('response', lambda response: report['network_errors'].append(f'{response.status} {response.url}') if response.status >= 400 else None)
        page.goto('http://127.0.0.1:4179', wait_until='load')
        page.wait_for_function('window.__ready || window.__gameError', timeout=180000)
        record('Static build loads all required modules and assets', page.evaluate('!!window.__ready && !window.__gameError'))
        page.locator('[data-act="new"]').click()
        page.locator('[data-act="difficulty"][data-id="story"]').click()
        page.locator('[data-act="start"]').click()
        page.locator('[data-act="skip"]').click()
        record('Static build starts the playable story', page.evaluate('stormcrown.context==="mission" && !stormcrown.paused'))
        page.evaluate('window.__startPosition={x:stormcrown.sim.activeHero.x,z:stormcrown.sim.activeHero.z}')
        page.keyboard.down('w')
        page.wait_for_function('Math.hypot(stormcrown.sim.activeHero.x-__startPosition.x,stormcrown.sim.activeHero.z-__startPosition.z)>.2')
        page.keyboard.up('w')
        record('Keyboard movement works in the generated build')
        page.screenshot(path=str(OUT / 'gameplay.png'), animations='disabled')
        page.reload(wait_until='load')
        page.wait_for_function('window.__ready || window.__gameError', timeout=180000)
        page.locator('[data-act="continue"]').click()
        record('Built game reload restores the saved mission checkpoint', page.evaluate('stormcrown.context==="mission" && stormcrown.sim.mission.id==="s01"'))
        record('Built game has no JavaScript or shader errors', not report['errors'] and page.evaluate('!window.__gameError'))
        record('Built game has no failed runtime requests', not report['network_errors'])
        report['status'] = 'passed'
        browser.close()
except Exception:
    report['status'] = 'failed'
    report['failure'] = traceback.format_exc()
    raise
finally:
    (OUT / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    server.terminate()
    try:
        server.wait(timeout=5)
    except subprocess.TimeoutExpired:
        server.kill()
    server_log.close()
