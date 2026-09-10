import sys,asyncio,json
sys.path.insert(0,'/mnt/data')
from browser_harness import assemble,ROOT
from playwright.async_api import async_playwright
async def main():
 html=assemble("await import('./src/main.js');",(ROOT/'src/styles.css').read_text())
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  pg=await b.new_page(viewport={'width':1440,'height':900});pg.on('pageerror',lambda e:print('ERROR',str(e)[:500],flush=True));pg.on('console',lambda m:print('CONSOLE',m.type,m.text[:500],flush=True) if m.type=='error' else None)
  await pg.set_content(html,wait_until='domcontentloaded',timeout=90000);await pg.wait_for_function('window.__ready||window.__gameError',timeout=90000)
  await pg.evaluate('''()=>{stormcrown.applySettings({...stormcrown.settings,quality:'low',shadows:false,bloom:false,resolution:.7,adaptive:false}); stormcrown.startNewJourney('story');stormcrown.ui.skipDialogue();stormcrown.returnHub();window.keyevents=[];addEventListener('keydown',e=>keyevents.push([e.key,e.code,e.target.tagName]));stormcrown.input.on('system',s=>keyevents.push(s));}''')
  print('START',await pg.evaluate('({current:stormcrown.ui.current,diag:stormcrown.diagnostics(),enabled:stormcrown.input.enabled})'),flush=True)
  await pg.keyboard.press('KeyM');await pg.wait_for_timeout(500)
  print('M',await pg.evaluate('({current:stormcrown.ui.current?.name,events:keyevents,el:document.activeElement.outerHTML.slice(0,500),text:document.querySelector("#overlay").textContent.slice(0,300)})'),flush=True)
  await pg.screenshot(path='/mnt/data/stormcrown-board-02.png')
  if not await pg.evaluate('!!stormcrown.ui.current'): await pg.locator('#hud [data-act="board"]').click()
  print('BOARD',await pg.evaluate('({current:stormcrown.ui.current?.name,diag:stormcrown.diagnostics()})'),flush=True)
  await pg.keyboard.press('Escape');await pg.keyboard.press('KeyI');await pg.wait_for_timeout(500)
  print('I',await pg.evaluate('({current:stormcrown.ui.current?.name,events:keyevents})'),flush=True)
  await pg.screenshot(path='/mnt/data/stormcrown-roster-02.png')
  await pg.evaluate('stormcrown.openPanel("roster")');await pg.wait_for_timeout(200)
  print('MANUAL',await pg.evaluate('({current:stormcrown.ui.current?.name,text:document.querySelector("#overlay").textContent.slice(0,500)})'),flush=True)
  await pg.screenshot(path='/mnt/data/stormcrown-roster-03.png')
  await b.close()
asyncio.run(main())
