import sys,asyncio,json
sys.path.insert(0,'/mnt/data')
from browser_harness import assemble,ROOT
from playwright.async_api import async_playwright
async def main():
 html=assemble("await import('./src/main.js');",(ROOT/'src/styles.css').read_text())
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  page=await browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
  errors=[]
  page.on('pageerror',lambda e:(errors.append(str(e)),print('ERR',str(e)[:500],flush=True)))
  page.on('console',lambda m: print('CONSOLE',m.type,m.text[:900],flush=True) if m.type=='error' else None)
  print('LOAD',len(html),flush=True)
  await page.set_content(html,wait_until='domcontentloaded',timeout=60000)
  await page.wait_for_function('window.__ready===true || window.__gameError',timeout=90000)
  print('BOOT',await page.evaluate('({ready:window.__ready,error:window.__gameError?.slice(0,250),diag:window.stormcrown?.diagnostics()})'),flush=True)
  await page.wait_for_timeout(1200)
  await page.screenshot(path='/mnt/data/stormcrown-menu-01.png')
  if not await page.evaluate('!!window.__gameError'):
   await page.locator('[data-act=new]').click()
   await page.screenshot(path='/mnt/data/stormcrown-new-01.png')
   await page.locator('[data-act=start]').click()
   print('START',await page.evaluate('stormcrown.diagnostics()'),flush=True)
   await page.screenshot(path='/mnt/data/stormcrown-dialogue-01.png')
   await page.locator('[data-act=skip]').click()
   await page.keyboard.down('KeyW');await page.wait_for_timeout(1500);await page.keyboard.up('KeyW')
   await page.keyboard.down('KeyJ');await page.wait_for_timeout(1700);await page.keyboard.up('KeyJ')
   await page.keyboard.press('KeyQ');await page.wait_for_timeout(400)
   await page.screenshot(path='/mnt/data/stormcrown-gameplay-01.png')
   print('GAME',await page.evaluate('({error:window.__gameError?.slice(0,250),diag:stormcrown.diagnostics(),hero:{x:stormcrown.sim.activeHero.x,z:stormcrown.sim.activeHero.z},cp:stormcrown.profile.checkpoint,keys: [...stormcrown.input.keys]})'),flush=True)
   await page.keyboard.press('Escape');await page.locator('[data-act=hub]').click();await page.locator('[data-act=yes]').click()
   await page.wait_for_timeout(1000);await page.screenshot(path='/mnt/data/stormcrown-warden-01.png')
   print('HUB',await page.evaluate('({error:window.__gameError?.slice(0,250),diag:stormcrown.diagnostics()})'),flush=True)
   await page.keyboard.press('KeyM');await page.screenshot(path='/mnt/data/stormcrown-board-01.png')
   await page.keyboard.press('Escape');await page.keyboard.press('KeyI');await page.screenshot(path='/mnt/data/stormcrown-roster-01.png')
   print('DONE',errors,flush=True)
  await browser.close()
asyncio.run(main())
