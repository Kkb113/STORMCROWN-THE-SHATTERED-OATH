"""Limited archive HTTP smoke check, NOT a full campaign test.
Requires Python/Playwright and Chromium. Uses real browser localStorage.
"""
from pathlib import Path
import asyncio, json, os, shutil, socket, subprocess, time
from urllib.request import urlopen
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs/recovery'

async def exercise(url, report):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        exe = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser')
        options = dict(headless=True, args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
        if exe: options['executable_path'] = exe
        browser = await p.chromium.launch(**options)
        try:
            page = await browser.new_page(viewport={'width':1280,'height':720})
            page.on('pageerror',lambda e: report['pageErrors'].append(str(e)))
            page.on('console',lambda m: report['consoleErrors'].append(m.text) if m.type=='error' else None)
            page.on('response',lambda r: report['httpErrors'].append({'status':r.status,'url':r.url}) if r.status>=400 else None)
            # Keep native storage. Only choose low rendering settings for software-GPU testing.
            await page.add_init_script("if(!localStorage.getItem('stormcrown.settings.v1'))localStorage.setItem('stormcrown.settings.v1',JSON.stringify({quality:'low',shadows:false,bloom:false,ao:false,resolution:.5,adaptive:false,particles:.4,flashes:0}));")
            async def ready():
                await page.wait_for_function('window.__ready===true || !!window.__gameError',timeout=60000)
                error=await page.evaluate('window.__gameError||null')
                assert not error,error
            await page.goto(url,wait_until='domcontentloaded',timeout=30000)
            await ready(); report['checks']['httpBoot']=True
            print('HTTP boot passed',flush=True)
            await page.locator('[data-act=new]').click()
            await page.locator('[data-act=start]').click()
            await page.locator('[data-act=skip]').click()
            await page.wait_for_function("stormcrown.context==='mission'&&!stormcrown.paused")
            before=await page.evaluate('({x:stormcrown.sim.activeHero.x,z:stormcrown.sim.activeHero.z})')
            await page.keyboard.down('KeyW'); await page.wait_for_timeout(1000); await page.keyboard.up('KeyW')
            after=await page.evaluate('({x:stormcrown.sim.activeHero.x,z:stormcrown.sim.activeHero.z})')
            assert abs(after['x']-before['x'])+abs(after['z']-before['z'])>.01,'Movement did not change position'
            report['checks']['movement']={'before':before,'after':after}
            await page.keyboard.down('KeyJ'); await page.wait_for_timeout(600); await page.keyboard.up('KeyJ')
            await page.keyboard.press('KeyQ'); await page.wait_for_timeout(350)
            checkpoint=await page.evaluate('stormcrown.saveStore.load(0)?.checkpoint?.mission')
            assert checkpoint,'No real browser save checkpoint'
            report['checks']['firstMissionAndInput']=await page.evaluate('stormcrown.diagnostics()')
            await page.screenshot(path=str(OUT/'http-smoke-gameplay.png'))
            print('First mission input and saved checkpoint passed',flush=True)
            await page.reload(wait_until='domcontentloaded'); await ready()
            await page.locator('[data-act=continue]').click()
            await page.wait_for_function("stormcrown.context==='mission'")
            resumed=await page.evaluate('stormcrown.sim.mission.id')
            assert resumed==checkpoint,'Checkpoint mission mismatch'
            report['checks']['httpSaveReloadContinue']={'checkpointMission':checkpoint,'resumedMission':resumed}
            print('Real localStorage reload/continue passed',flush=True)
            await page.keyboard.press('Escape')
            await page.locator('[data-act=hub]').click()
            await page.locator('[data-act=yes]').click()
            await page.wait_for_function("stormcrown.context==='hub'")
            await page.keyboard.press('KeyM'); await page.wait_for_timeout(300)
            report['checks']['missionBoard']=await page.evaluate('stormcrown.ui.current?.name')
            assert report['checks']['missionBoard']=='board','Board not open'
            await page.keyboard.press('Escape'); await page.keyboard.press('KeyI'); await page.wait_for_timeout(300)
            report['checks']['roster']=await page.evaluate('stormcrown.ui.current?.name')
            assert report['checks']['roster']=='roster','Roster not open'
            report['checks']['finalDiagnostics']=await page.evaluate('stormcrown.diagnostics()')
            assert not report['pageErrors'],'Page errors'
            assert not report['httpErrors'],'HTTP errors'
            assert not report['consoleErrors'],'Console errors'
            report['status']='passed'
        finally:
            await browser.close()

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    report={'status':'failed','scope':'Local HTTP boot; first-mission movement and attack/ability inputs; native browser localStorage checkpoint reload/continue; Warden, mission board and roster. Not a complete mission/campaign playthrough or performance benchmark.','rendering':'Headless Chromium software renderer; low settings only for this check.','checks':{},'pageErrors':[],'consoleErrors':[],'httpErrors':[]}
    with socket.socket() as listener:
        listener.bind(('127.0.0.1',0)); port=listener.getsockname()[1]
    node=shutil.which('node')
    if not node: raise RuntimeError('Node.js is required')
    url=f'http://127.0.0.1:{port}/'; log=open(OUT/'http-server.log','w')
    server=subprocess.Popen([node,'tools/serve.mjs',str(port)],cwd=ROOT,stdout=log,stderr=log)
    failure=None
    try:
        for _ in range(100):
            try:
                with urlopen(url,timeout=1) as r: assert r.status==200
                break
            except OSError:
                if server.poll() is not None: raise RuntimeError('Server exited')
                time.sleep(.1)
        else: raise RuntimeError('Server readiness timeout')
        asyncio.run(exercise(url,report))
    except Exception as error:
        report['error']=str(error); failure=error
    finally:
        server.terminate()
        try: server.wait(timeout=5)
        except subprocess.TimeoutExpired: server.kill(); server.wait()
        log.close(); (OUT/'http-smoke.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2),flush=True)
    if failure: raise SystemExit(1)
if __name__=='__main__': main()
