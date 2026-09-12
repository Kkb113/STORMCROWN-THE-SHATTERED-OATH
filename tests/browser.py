"""Actual Chromium/WebGL smoke tests. Run: pip install playwright==1.55.0;
python -m playwright install chromium; python tests/browser.py.
CI renders with SwiftShader: its timings are NOT a consumer GPU FPS benchmark.
"""
import json
import os
from pathlib import Path
import subprocess
import time
import traceback
from urllib.request import urlopen
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results/browser'
OUT.mkdir(parents=True, exist_ok=True)
report = {'revision': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(), 'workingTree': subprocess.check_output(['git', 'status', '--short'], cwd=ROOT, text=True).splitlines(), 'checks': [], 'errors': [], 'network_errors': [], 'samples': [], 'scope': 'Chromium browser checks, production-input expedition pilots and software-rendering measurements; not a human campaign playthrough or hardware performance certification.'}
server_log = (OUT / 'server.log').open('w')
server = subprocess.Popen(['node', 'tools/serve.mjs'], cwd=ROOT, stdout=server_log, stderr=subprocess.STDOUT, env={**os.environ, 'PORT': '4178'})

def record(name, value=True):
    if not value:
        raise AssertionError(name)
    report['checks'].append(name)
    print('PASS', name, flush=True)

try:
    for _ in range(100):
        if server.poll() is not None:
            raise RuntimeError('Browser-test server exited; see server.log')
        try:
            with urlopen('http://127.0.0.1:4178', timeout=1) as response:
                if response.status == 200:
                    break
        except OSError:
            time.sleep(.1)
    else:
        raise RuntimeError('Browser-test server did not become ready')
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        context = browser.new_context(viewport={'width': 1280, 'height': 720}, device_scale_factor=1)
        page = context.new_page()
        page.set_default_timeout(120000)
        page.on('pageerror', lambda error: report['errors'].append(str(error)))
        page.on('console', lambda message: report['errors'].append(message.text) if message.type == 'error' else None)
        page.on('response', lambda response: report['network_errors'].append(f'{response.status} {response.url}') if response.status >= 400 else None)
        page.goto('http://127.0.0.1:4178', wait_until='load')
        page.wait_for_function('window.__ready || window.__gameError', timeout=180000)
        record('WebGL startup and title screen', page.evaluate('!!window.__ready && !window.__gameError'))
        page.evaluate('stormcrown.applySettings({...stormcrown.settings, adaptive:false, quality:"high"}, false)')
        page.screenshot(path=str(OUT / '01-title.png'), animations='disabled')
        page.locator('[data-act="new"]').click()
        page.locator('[data-act="difficulty"][data-id="story"]').click()
        page.locator('[data-act="start"]').click()
        page.locator('[data-act="skip"]').click()
        record('New journey reaches controllable gameplay', page.evaluate('stormcrown.context === "mission" && !stormcrown.paused'))
        page.keyboard.press('2')
        page.wait_for_function('stormcrown.sim.activeIndex === 1')
        record('Keyboard instantly switches the active party member')
        page.keyboard.press('1')
        page.wait_for_function('stormcrown.sim.activeIndex === 0')
        before = page.evaluate('({x:stormcrown.sim.activeHero.x,z:stormcrown.sim.activeHero.z})')
        page.keyboard.down('w')
        page.wait_for_timeout(1800)
        page.keyboard.up('w')
        after = page.evaluate('({x:stormcrown.sim.activeHero.x,z:stormcrown.sim.activeHero.z})')
        record('Keyboard movement changes world position', abs(after['x']-before['x'])+abs(after['z']-before['z']) > .2)
        page.keyboard.press('Space')
        page.keyboard.down('j')
        page.wait_for_timeout(1000)
        page.keyboard.up('j')
        page.keyboard.press('q')
        page.wait_for_timeout(1000)
        page.keyboard.press('Escape')
        record('Pause stops simulation', page.evaluate('stormcrown.paused && stormcrown.ui.current.name === "pause"'))
        tick = page.evaluate('stormcrown.sim.tick')
        page.wait_for_timeout(300)
        record('Paused world clock remains still', page.evaluate('stormcrown.sim.tick') == tick)
        page.locator('[data-act="resume"]').click()
        page.screenshot(path=str(OUT / '02-gameplay.png'), animations='disabled')
        # Cancel only the outer animation loop for deterministic render samples.
        page.evaluate('cancelAnimationFrame(stormcrown.raf)')
        for quality in ['high', 'medium', 'low']:
            sample = page.evaluate('''quality => {
              const a=stormcrown,r=a.renderer;
              a.applySettings({...a.settings,quality,adaptive:false,ao:false},false);
              for(let i=0;i<3;i++)r.render(1/60);
              const gl=r.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
              const samples=[];
              for(let i=0;i<12;i++){const t=performance.now();r.render(1/60);gl.finish();samples.push(performance.now()-t);}
              samples.sort((a,b)=>a-b);
              return {quality,medianFrameMs:samples[6],p95FrameMs:samples[11],...r.stats,
                renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
                actors:r.actors.size,viewport:[innerWidth,innerHeight],scope:'Synchronous SwiftShader render sample, not real GPU FPS'};
            }''', quality)
            report['samples'].append(sample)
            print('RENDER', json.dumps(sample), flush=True)
        page.evaluate('stormcrown.returnHub(); stormcrown.renderer.render(1/60)')
        record('Warden hub transition', page.evaluate('stormcrown.context === "hub" && stormcrown.sim.world.isHub'))
        for panel in ['board', 'roster', 'codex', 'training', 'settings', 'saves']:
            page.evaluate('(panel)=>{stormcrown.openPanel(panel);stormcrown.renderer.render(1/60)}', panel)
            record(f'{panel} panel renders', page.evaluate('stormcrown.ui.current.name') == panel)
            if panel in ['board', 'roster']:
                page.screenshot(path=str(OUT / f'03-{panel}.png'), animations='disabled')
            page.evaluate('stormcrown.ui.clear()')
        record('Manual save readback', page.evaluate('stormcrown.saveToSlot(1) && !!stormcrown.saveStore.load(1)'))
        saved = page.evaluate('stormcrown.saveStore.load(0).created')
        page.reload(wait_until='load')
        page.wait_for_function('window.__ready || window.__gameError', timeout=180000)
        page.locator('[data-act="continue"]').click()
        record('Reload and Continue restore persistent journey', page.evaluate('stormcrown.profile.created') == saved)
        record('Restored journey returns to hub', page.evaluate('stormcrown.context === "hub"'))
        # Progression is a declared fixture; the routes themselves use production
        # movement, targeting, hazards and combat, without granting victory.
        page.evaluate('''async () => {
          cancelAnimationFrame(stormcrown.raf);
          const {createProfile,finishMission}=await import('/src/game/progression.js');
          const {CAMPAIGN}=await import('/src/data/campaign.js');
          const p=createProfile('story');
          for(const m of CAMPAIGN.slice(0,12))finishMission(p,m,{time:100});
          stormcrown.loadProfile(p);
          stormcrown.applySettings({...stormcrown.settings,quality:'high',adaptive:false},false);
        }''')
        for region, mission_id, screenshot in [(0, 'x01', '04-stormglass.png'), (1, 'x02', '05-lava-escape.png')]:
            page.evaluate('(region)=>stormcrown.openPanel("board",{region})', region)
            page.locator('[data-act="category"][data-category="expedition"]').click()
            record(f'{mission_id}: expedition appears on the Warden board', page.locator(f'[data-act="mission"][data-id="{mission_id}"]').count() == 1)
            page.locator(f'[data-act="mission"][data-id="{mission_id}"]').click()
            page.locator('[data-act="launch"]').click()
            page.locator('[data-act="skip"]').click()
            record(f'{mission_id}: board launches the playable mission', page.evaluate('stormcrown.sim.mission.id') == mission_id)
            scene = page.evaluate('''async id => {
              const {drive}=await import('/tests/helpers/browser-pilot.mjs');
              const a=stormcrown;
              return drive(a,{until:s=>id==='x01'
                ?s.hazards.some(h=>h.visual==='stormwall'&&h.active)
                :s.director.index===2&&s.hazards.some(h=>h.lavaFront&&h.active)});
            }''', mission_id)
            report.setdefault('scenes', {})[mission_id] = scene
            record(f'{mission_id}: distinct environmental hazard is active', scene['state'] == 'running' and ('stormwall' if mission_id == 'x01' else 'lava') in scene['hazards'])
            record(f'{mission_id}: rendered hazard matches its moving collision footprint', page.evaluate('''() => {
              const s=stormcrown.sim,r=stormcrown.renderer,h=s.hazards.find(h=>h.visual==='lava'||h.visual==='stormwall');
              const m=r.vfx.telegraphs.get(h.id);
              return !!m && Math.abs(m.position.x-h.x)<.001 && Math.abs(m.position.z-h.z)<.001
                && Math.abs(m.scale.x-h.width)<.001 && Math.abs(m.scale.y-h.length)<.001;
            }'''))
            page.mouse.move(640, 360)
            if mission_id == 'x02':
                page.evaluate('stormcrown.renderer.settings.cameraZoom=1.4;stormcrown.renderer.updateCamera(0,true);stormcrown.renderer.render(0);stormcrown.ui.hud.update(0,true)')
            page.screenshot(path=str(OUT / screenshot), animations='disabled')
            outcome = page.evaluate('''async () => {
              const {drive}=await import('/tests/helpers/browser-pilot.mjs');
              const a=stormcrown,result=drive(a);a.renderer.settings.cameraZoom=1;
              a.lastFrame=performance.now();a.raf=requestAnimationFrame(a.frame);
              return result;
            }''')
            record(f'{mission_id}: production gameplay reaches victory', outcome['state'] == 'victory')
            page.wait_for_function('stormcrown.ui.current?.name === "rewards"')
            record(f'{mission_id}: victory freezes combat while presenting rewards', page.evaluate('stormcrown.paused && !stormcrown.input.enabled'))
            wallet = page.evaluate('stormcrown.profile.aether')
            page.keyboard.press('Escape')
            record(f'{mission_id}: Escape cannot dismiss the victory flow', page.evaluate('stormcrown.ui.current?.name === "rewards"'))
            page.evaluate('stormcrown.sim.emit("missionComplete",{mission:stormcrown.sim.mission,result:stormcrown.sim.stats})')
            record(f'{mission_id}: duplicate completion cannot grant a second reward', page.evaluate('stormcrown.profile.aether') == wallet)
            page.locator('[data-act="continue"]').click()
            page.locator('[data-act="skip"]').click()
            record(f'{mission_id}: victory returns to the Warden and saves completion', page.evaluate('(id)=>stormcrown.context==="hub" && stormcrown.saveStore.load(0).completed.includes(id)', mission_id))
            page.evaluate('cancelAnimationFrame(stormcrown.raf)')
        record('Expeditions retain the next main story chapter', page.evaluate('stormcrown.profile.completed.filter(id=>/^[scwvh][0-9]{2}$/.test(id)).length===12'))
        record('Expedition saves leave the original manual slot intact', page.evaluate('stormcrown.saveStore.load(1).created') == saved)
        page.evaluate('stormcrown.renderer.render(1/60);stormcrown.ui.update(1/60)')
        page.screenshot(path=str(OUT / '06-warden.png'), animations='disabled')
        page.evaluate('stormcrown.ui.open("newHero",{id:"nym",after:()=>stormcrown.returnHub()},{clear:true})')
        page.keyboard.press('Escape')
        record('Recruitment cannot strand the journey when Escape is pressed', page.evaluate('stormcrown.ui.current?.name === "newHero"'))
        page.locator('[data-act="continue"]').click()
        record('Recruitment confirmation resumes the hub', page.evaluate('stormcrown.context === "hub" && !stormcrown.ui.current'))
        report['renderChecks'] = page.evaluate('''async () => {
          const checks=await import('/tests/helpers/render-checks.mjs');
          return {geometry:checks.geometryChecks(),creatures:checks.creatureChecks(stormcrown),
            interpolation:checks.interpolationCheck(stormcrown),resources:checks.regionResourceChecks(stormcrown)};
        }''')
        record('Platform normals, creature joints, frame interpolation and five-region resource cleanup')
        page.set_viewport_size({'width': 390, 'height': 844})
        page.evaluate('stormcrown.openPanel("board",{category:"expedition",region:0});stormcrown.renderer.render(0)')
        record('Expedition navigation fits a narrow viewport', page.evaluate('document.querySelector(".board-tabs").scrollWidth <= document.querySelector(".board-tabs").clientWidth + 1'))
        page.screenshot(path=str(OUT / '07-mobile-board.png'), animations='disabled')
        page.evaluate('stormcrown.ui.clear()')
        page.set_viewport_size({'width': 1280, 'height': 720})
        page.evaluate('stormcrown.audio.unlock()')
        report['audio'] = page.evaluate('stormcrown.audio.diagnostics')
        report['final'] = page.evaluate('stormcrown.diagnostics()')
        record('No game fatal error', page.evaluate('!window.__gameError'))
        record('No JavaScript or console errors', not report['errors'])
        record('No failed runtime asset requests', not report['network_errors'])
        report['status'] = 'passed'
        browser.close()
except Exception as error:
    report['status'] = 'failed'
    report['failure'] = traceback.format_exc()
    print(report['failure'], flush=True)
    raise
finally:
    (OUT / 'report.json').write_text(json.dumps(report, indent=2))
    server.terminate()
    try:
        server.wait(timeout=5)
    except subprocess.TimeoutExpired:
        server.kill()
    server_log.close()
