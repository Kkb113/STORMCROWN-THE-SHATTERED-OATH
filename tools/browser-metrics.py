"""Repeatable render fixture, not a hardware FPS benchmark or campaign playthrough.
Uses a normal HTTP origin and Chromium's software GPU in CI. The snapshot is a
paused opening encounter so geometry and draw-call comparisons are meaningful.
"""
import asyncio
import json
import os
import subprocess
from pathlib import Path
from urllib.request import urlopen
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'qa'

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    log = open(OUT / 'metrics-server.log', 'w')
    server = subprocess.Popen(['node', 'tools/serve.mjs', '4187'], cwd=ROOT, stdout=log, stderr=log)
    report = {'scope': 'Paused opening encounter, 1280x720, high, resolution 0.6, bloom and shadows on, AO and adaptive off. Software GPU, not representative hardware FPS.', 'errors': []}
    try:
        for _ in range(60):
            try:
                with urlopen('http://127.0.0.1:4187/', timeout=1) as response:
                    assert response.status == 200
                break
            except OSError:
                await asyncio.sleep(.2)
        async with async_playwright() as p:
            options = {'headless': True, 'args': ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage']}
            if os.environ.get('CHROMIUM_PATH'):
                options['executable_path'] = os.environ['CHROMIUM_PATH']
            browser = await p.chromium.launch(**options)
            try:
                page = await browser.new_page(viewport={'width': 1280, 'height': 720})
                page.on('pageerror', lambda e: report['errors'].append(str(e)))
                page.on('console', lambda m: report['errors'].append(m.text) if m.type == 'error' else None)
                await page.add_init_script("localStorage.setItem('stormcrown.settings.v1',JSON.stringify({quality:'high',resolution:.6,shadows:true,bloom:true,ao:false,adaptive:false,music:0,flashes:.4}));")
                await page.goto('http://127.0.0.1:4187/', wait_until='domcontentloaded')
                await page.wait_for_function('window.__ready || window.__gameError', timeout=90000)
                assert not await page.evaluate('window.__gameError || null')
                await page.locator('[data-act=new]').click()
                await page.locator('[data-act=start]').click()
                await page.locator('[data-act=skip]').click()
                await page.evaluate("stormcrown.openPanel('pause')")
                await page.wait_for_timeout(1500)
                # Hide the modal visually without unpausing the simulation.
                await page.add_style_tag(content='.modal-backdrop,.modal-layer,.modal-overlay{visibility:hidden !important}')
                await page.screenshot(path=str(OUT / 'opening-encounter.png'))
                report['diagnostics'] = await page.evaluate('stormcrown.diagnostics()')
                report['scene'] = await page.evaluate('''() => {
                    const r = stormcrown.renderer; let meshes=0, triangles=0, geometries=new Set();
                    r.scene.traverse(o => {if(o.isMesh){meshes++;geometries.add(o.geometry);triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
                    const gl=r.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
                    return {meshes,triangles,uniqueGeometries:geometries.size,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown'};
                }''')
                await page.evaluate('stormcrown.returnHub()')
                await page.keyboard.press('KeyI')
                await page.wait_for_timeout(1000)
                await page.screenshot(path=str(OUT / 'crew-and-builds.png'))
                assert not report['errors'], report['errors']
                report['status'] = 'passed'
            finally:
                await browser.close()
    except Exception as error:
        report['status'] = 'failed'
        report['failure'] = str(error)
        raise
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait()
        log.close()
        (OUT / 'render-metrics.json').write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report, indent=2), flush=True)

if __name__ == '__main__':
    asyncio.run(main())
