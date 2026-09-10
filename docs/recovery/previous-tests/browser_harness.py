"""Exercise locally authored modules in an about:blank document.
No browsing or filesystem permissions are changed. Source and CC0 asset bytes are
provided to the browser as in-memory data URLs because navigation is disabled in
this development container. Release CI uses an ordinary localhost HTTP server.
"""
import asyncio,base64,json,mimetypes,re
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path('/mnt/data/STORMCROWN-THE-SHATTERED-OATH')
IMPORT=re.compile(r'(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)[\'\"]([^\'\"]+)[\'\"]')

def resolved(spec,path):
 if spec=='three': return ROOT/'vendor/three.module.js'
 if spec.startswith('three/addons/'): return ROOT/'vendor/addons'/spec[13:]
 if spec.startswith('.'): return (path.parent/spec).resolve()
 return None

def rewrite(source,path,load):
 def sub(m):
  spec=m.group(1);target=resolved(spec,path)
  if target and target.is_file():
   load(target)
   return m.group(0).replace(spec,'@storm/'+target.relative_to(ROOT).as_posix())
  return m.group(0)
 return IMPORT.sub(sub,source)

def assemble(entry,css='',extra_head=''):
 imports={};seen=set()
 def load(path):
  if path in seen:return
  seen.add(path)
  source=rewrite(path.read_text(),path,load)
  imports['@storm/'+path.relative_to(ROOT).as_posix()]='data:text/javascript;base64,'+base64.b64encode(source.encode()).decode()
 script=rewrite(entry,ROOT/'entry.js',load)
 assets={}
 for path in (ROOT/'assets').rglob('*'):
  if path.is_file() and path.suffix in ('.webp','.hdr','.svg','.png'):
   mime={'.hdr':'application/octet-stream'}.get(path.suffix,mimetypes.guess_type(path)[0] or 'application/octet-stream')
   assets[path.relative_to(ROOT).as_posix()]='data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode()
 load(ROOT/'vendor/three.module.js')
 # The loading manager is exactly the same one used by the real renderer.
 prefix="import * as THREE from '@storm/vendor/three.module.js';THREE.DefaultLoadingManager.setURLModifier(url=>window.__assets[url.replace(/^\.\//,'')]||url);"
 html=f'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>{css}</style>{extra_head}<script type="importmap">{json.dumps({'imports':imports})}</script></head><body><canvas id="world"></canvas><div id="vignette"></div><div id="damage-flash"></div><div id="ui"></div><div id="notifications" aria-live="polite"></div><div id="loading"><span id="loading-label">Loading</span><div id="loading-bar"></div></div><div id="status"></div><script>window.__assets={json.dumps(assets)};window.__HARNESS=true;class MemoryStorage{{constructor(){{this.data={{}}}}getItem(k){{return this.data[k]??null}}setItem(k,v){{this.data[k]=String(v)}}removeItem(k){{delete this.data[k]}}clear(){{this.data={{}}}}}}Object.defineProperty(window,'localStorage',{{value:new MemoryStorage()}});</script><script type="module">{prefix}{script}</script></body></html>'''
 return html

async def capture(entry,output='/mnt/data/stormcrown-visual-01.png',width=1440,height=810,wait=3000,action=None):
 html=assemble(entry,'html,body{margin:0;overflow:hidden;background:#101521}canvas#world{width:100vw;height:100vh;display:block}#status{position:absolute;top:8px;left:8px;color:white;font:14px monospace;background:#0007;padding:6px}#loading{display:none}')
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  page=await browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
  errors=[]
  print('BROWSER OPEN',flush=True)
  page.on('pageerror',lambda e: (errors.append(str(e)[:4000]),print('PAGEERROR',str(e)[:1200],flush=True)))
  page.on('console',lambda m: (errors.append(m.text[:4000]),print('CONSOLE',m.type,m.text[:1200],flush=True)) if m.type=='error' else print('CONSOLE',m.type,m.text[:300],flush=True))
  print('SET CONTENT',len(html),flush=True)
  await page.set_content(html,wait_until='domcontentloaded',timeout=60000)
  print('CONTENT SET',flush=True)
  try:
   await page.wait_for_function('window.__ready===true',timeout=60000)
   print('READY',flush=True)
  except Exception as e:print('READY FAIL',e)
  await page.wait_for_timeout(wait)
  if action: await action(page)
  await page.screenshot(path=output)
  print('ERRORS',json.dumps(errors)[:15000]);print('STATS',await page.evaluate('window.renderer?.stats'))
  await browser.close()

if __name__=='__main__':
 fixture=(ROOT/'tests/visual.html').read_text();entry=fixture.split('<script type="module">')[1].split('</script>')[0]
 asyncio.run(capture(entry))
