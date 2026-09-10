import { GameApp } from './app/game.js';

async function start(){
  try{
    const app=new GameApp(document.getElementById('world'),document.getElementById('ui'));
    // A read-only-by-convention diagnostics handle also supports reproducible QA.
    // There are no URL-based cheats or production invulnerability switches.
    globalThis.stormcrown=app;
    await app.boot();
  }catch(error){
    console.error(error);globalThis.__gameError=error.stack||String(error);
    const loading=document.getElementById('loading');loading?.classList.remove('hidden');
    if(loading){loading.replaceChildren();const h=document.createElement('h1');h.textContent='Unable to open the falling world';const p=document.createElement('p');p.textContent=error.message;const help=document.createElement('p');help.textContent='STORMCROWN needs WebGL 2 and a modern browser. Enable hardware acceleration and serve the project with npm start rather than opening index.html directly.';loading.append(h,p,help);}
  }
}
start();
