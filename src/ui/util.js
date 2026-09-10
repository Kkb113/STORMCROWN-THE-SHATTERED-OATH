import { safeText } from '../core/math.js';
import { icon } from './icons.js';
export const esc=safeText;
export function clock(seconds){const n=Math.max(0,Math.floor(seconds||0)),h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;return h?`${h}h ${String(m).padStart(2,'0')}m`:`${m}:${String(s).padStart(2,'0')}`;}
export function date(timestamp){try{return new Date(timestamp).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});}catch{return 'Unknown date';}}
export function number(n){return Math.round(n||0).toLocaleString();}
export function button(label,action,{kind='',glyph='',disabled=false,data='',title='',key=''}={}){return `<button type="button" class="button ${kind}" data-act="${action}" ${disabled?'disabled':''} ${data} ${title?`title="${esc(title)}"`:''}>${glyph?icon(glyph):''}<span>${label}</span>${key?`<kbd>${key}</kbd>`:''}</button>`;}
export function panelHeader(eyebrow,title,text='',action='close'){return `<header class="panel-header"><div><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1>${text?`<p class="panel-lede">${esc(text)}</p>`:''}</div>${action?button('Close',action,{kind:'icon-button',glyph:'close',key:'Esc'}):''}</header>`;}
export function key(label){return `<kbd>${label}</kbd>`;}
export function badge(label,cls=''){return `<span class="badge ${cls}">${esc(label)}</span>`;}
export function meter(percent,cls='',label=''){return `<div class="meter ${cls}" ${label?`role="meter" aria-label="${esc(label)}" aria-valuenow="${Math.round(percent*100)}" aria-valuemin="0" aria-valuemax="100"`:''}><i style="transform:scaleX(${Math.max(0,Math.min(1,percent))})"></i></div>`;}
export function splitLine(line){if(typeof line==='object')return line;const at=line.indexOf('|');return at<0?{speaker:'',text:line}:{speaker:line.slice(0,at),text:line.slice(at+1)};}
export function focusable(root){return [...root.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],textarea')].filter(el=>el.getClientRects().length);}
export function downloadFile(text,name,type='application/json'){
  const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
