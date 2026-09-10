import { REGIONS } from '../data/regions.js';
import { clamp } from '../core/math.js';

const MOTIFS = [
  [0,7,12,10,7,3,5,7,0,3,7,14,12,10,7,5],
  [0,0,7,3,0,10,7,5,0,12,10,7,3,5,2,0],
  [12,7,3,10,14,12,7,5,12,15,14,10,7,3,5,7],
  [0,7,12,14,7,5,12,7,3,10,15,14,12,7,5,3],
  [0,7,3,10,12,7,14,10,3,7,12,15,14,10,7,0],
];
const pentatonic=[0,3,5,7,10];

/** Original, locally synthesized adaptive score and combat soundscape.
 * The audio context is created only after a user gesture. No network media,
 * autoplay exceptions, hidden microphone access, or browser permissions. */
export class AudioSystem {
  constructor(settings){
    this.settings=settings;this.context=null;this.sim=null;this.unsub=[];this.voices=new Set();this.nextBeat=0;this.beat=0;this.region=0;this.intensity=0;this.targetIntensity=0;this.paused=false;this.started=false;this.cinematic=false;this.lastSound=new Map();this.available=true;this.status='Waiting for first interaction';
  }
  async unlock(){
    try{
      if(!this.context)this.initialize();
      if(this.context?.state==='suspended')await this.context.resume();
      this.started=this.context?.state==='running';this.status=this.started?'Running':'Suspended by browser';
    }catch(error){this.available=false;this.status=error.message;}
  }
  initialize(){
    const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!Context){this.available=false;this.status='Web Audio is unavailable';return;}
    const ctx=this.context=new Context({latencyHint:'interactive'});
    this.master=ctx.createGain();this.music=ctx.createGain();this.effects=ctx.createGain();this.ambience=ctx.createGain();
    this.limiter=ctx.createDynamicsCompressor();Object.assign(this.limiter.threshold,{value:-9});this.limiter.knee.value=12;this.limiter.ratio.value=6;this.limiter.attack.value=.005;this.limiter.release.value=.24;
    this.master.connect(this.limiter);this.limiter.connect(ctx.destination);this.music.connect(this.master);this.effects.connect(this.master);this.ambience.connect(this.master);
    this.reverb=ctx.createConvolver();this.reverb.buffer=this.impulse(2.8,3.2);this.reverbGain=ctx.createGain();this.reverbGain.gain.value=.17;this.reverb.connect(this.reverbGain);this.reverbGain.connect(this.master);
    this.noiseBuffer=this.noise(4);this.rumbleBuffer=this.noise(6,true);
    this.bowedWave=this.wave([0,1,.28,.12,.2,.055,.09,.025,.035,.015]);
    this.choirWave=this.wave([0,1,.09,.23,.03,.12,.015,.075,.01,.03]);
    this.nextBeat=ctx.currentTime+.15;this.beat=0;this.started=true;this.status='Running';
    this.buildAmbience();this.applySettings(this.settings);
  }
  wave(harmonics){const re=new Float32Array(harmonics.length),im=new Float32Array(harmonics);return this.context.createPeriodicWave(re,im,{disableNormalization:false});}
  noise(duration,brown=false){
    const ctx=this.context,buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);let previous=0;
    for(let i=0;i<data.length;i++){const white=Math.random()*2-1;previous=(previous+.018*white)/1.018;data[i]=brown?previous*4:white;}
    return buffer;
  }
  impulse(duration,decay){const ctx=this.context,b=ctx.createBuffer(2,Math.floor(ctx.sampleRate*duration),ctx.sampleRate);for(let channel=0;channel<2;channel++){const a=b.getChannelData(channel);for(let i=0;i<a.length;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/a.length,decay)*(i<ctx.sampleRate*.02?.15:1);}return b;}
  buildAmbience(){
    const c=this.context;this.wind=c.createBufferSource();this.wind.buffer=this.rumbleBuffer;this.wind.loop=true;this.windFilter=c.createBiquadFilter();this.windFilter.type='lowpass';this.windFilter.frequency.value=620;this.windVolume=c.createGain();this.windVolume.gain.value=.12;this.wind.connect(this.windFilter).connect(this.windVolume).connect(this.ambience);this.wind.start();
    this.rain=c.createBufferSource();this.rain.buffer=this.noiseBuffer;this.rain.loop=true;this.rainFilter=c.createBiquadFilter();this.rainFilter.type='highpass';this.rainFilter.frequency.value=1150;this.rainVolume=c.createGain();this.rainVolume.gain.value=.014;this.rain.connect(this.rainFilter).connect(this.rainVolume).connect(this.ambience);this.rain.start();
  }
  applySettings(settings){
    this.settings=settings;if(!this.context)return;const t=this.context.currentTime;
    this.master.gain.setTargetAtTime(clamp(settings.master,0,1),t,.08);
    this.music.gain.setTargetAtTime(clamp(settings.music,0,1)*(this.paused?.7:1),t,.2);
    this.effects.gain.setTargetAtTime(clamp(settings.effects,0,1),t,.08);
    this.ambience.gain.setTargetAtTime(clamp(settings.effects,0,1)*.68,t,.2);
  }
  connectVoice(source,{gain=.2,time=this.context.currentTime,duration=.4,attack=.005,release=.1,bus=this.effects,pan=0,filter=0,reverb=.15}={}){
    if(this.voices.size>56){try{source.disconnect();}catch{}return null;}
    const ctx=this.context,envelope=ctx.createGain();envelope.gain.setValueAtTime(.0001,time);envelope.gain.exponentialRampToValueAtTime(Math.max(.0001,gain),time+Math.min(attack,duration*.4));envelope.gain.setTargetAtTime(.0001,time+Math.max(attack,duration-release),Math.max(.012,release/3));
    const panner=ctx.createStereoPanner();panner.pan.value=clamp(pan,-1,1);let node=source;
    let lowpass;if(filter){lowpass=ctx.createBiquadFilter();lowpass.type='lowpass';lowpass.frequency.value=filter;node.connect(lowpass);node=lowpass;}
    node.connect(envelope);envelope.connect(panner);panner.connect(bus);let wet;if(reverb){wet=ctx.createGain();wet.gain.value=reverb;envelope.connect(wet).connect(this.reverb);}
    this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();envelope.disconnect();panner.disconnect();lowpass?.disconnect();wet?.disconnect();};source.start(time);source.stop(time+duration+.08);return envelope;
  }
  tone(frequency,duration,gain=.12,options={}){
    if(!this.context||!this.started)return null;
    const osc=this.context.createOscillator(),t=options.time??this.context.currentTime;osc.type=options.type||'sine';if(options.wave)osc.setPeriodicWave(options.wave);osc.frequency.setValueAtTime(frequency,t);
    if(options.end)osc.frequency.exponentialRampToValueAtTime(Math.max(15,options.end),t+duration*.82);if(options.detune)osc.detune.value=options.detune;
    this.connectVoice(osc,{time:t,duration,gain,...options});return osc;
  }
  noiseHit(duration,gain,options={}){
    if(!this.started)return;
    const c=this.context,source=c.createBufferSource();source.buffer=options.brown?this.rumbleBuffer:this.noiseBuffer;source.playbackRate.value=options.rate||1;
    let node=source;
    if(options.band){const filter=c.createBiquadFilter();filter.type='bandpass';filter.frequency.value=options.band;filter.Q.value=options.q||.5;source.connect(filter);node=filter;}
    // An intermediary filter needs the same lifetime as the source, but remains
    // outside the voice helper's ownership so the source can still be stopped.
    if(node!==source){const filter=node;const t=options.time??c.currentTime,amp=c.createGain(),pan=c.createStereoPanner();amp.gain.setValueAtTime(.0001,t);amp.gain.exponentialRampToValueAtTime(Math.max(.001,gain),t+.006);amp.gain.exponentialRampToValueAtTime(.0001,t+duration);pan.pan.value=options.pan||0;filter.connect(amp).connect(pan).connect(options.bus||this.effects);source.start(t);source.stop(t+duration);this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();filter.disconnect();amp.disconnect();pan.disconnect();};}
    else this.connectVoice(source,{duration,gain,attack:.003,release:duration*.85,...options});
  }
  metal(frequency,volume=.15,pan=0){const t=this.context.currentTime;[1,1.47,2.11,2.73,4.1].forEach((m,i)=>this.tone(frequency*m,.28+i*.065,volume/(1+i*1.7),{time:t,type:'sine',pan,release:.32,reverb:.17}));}
  spatial(event){const p=this.sim?.activeHero;if(!p||!Number.isFinite(event.x))return{pan:0,gain:event.volume??1};const x=event.x-p.x,z=event.z-p.z,d=Math.hypot(x,z);return {pan:clamp((x*.8-z*.6)/24,-.85,.85),gain:(event.volume??1)/(1+d*.035)};}
  sound(event={}){
    if(!this.started||!this.context||this.paused&&event.type!=='ui')return;
    const now=this.context.currentTime,type=event.type||'ui',min={hit:.045,swing:.055,heavySwing:.08,cast:.065,thunder:.12,ui:.045}[type]??.018;
    if(now-(this.lastSound.get(type)??-99)<min)return;this.lastSound.set(type,now);
    const {pan,gain:v}=this.spatial(event),element=event.element||'storm',pitch={storm:330,fire:145,frost:690,earth:73,shadow:196,light:440,nature:130,wind:520,arcane:294,spirit:246,void:164}[element]||220;
    switch(type){
      case 'ui':this.tone(410,.055,.03,{end:570,pan:0});break;
      case 'swing':case 'heavySwing':this.noiseHit(type==='swing'?.17:.28,.15*v,{band:type==='swing'?2200:900,q:.6,pan});break;
      case 'dodge':this.noiseHit(.22,.09*v,{band:1600,q:.5,pan});break;
      case 'hit':case 'critical':this.noiseHit(.11,.2*v,{band:1050,q:.7,pan});this.tone(type==='critical'?78:100,.13,.22*v,{end:36,pan,release:.12});if(type==='critical')this.metal(440,.06*v,pan);break;
      case 'heavy':case 'impact':case 'explosion':this.noiseHit(.65,.28*v,{brown:true,pan,filter:2400});this.tone(98,.55,.4*v,{end:25,pan,release:.48});this.noiseHit(.14,.2*v,{band:1200,pan});break;
      case 'parry':this.metal(940,.15*v,pan);this.tone(170,.13,.22*v,{end:44,pan});break;
      case 'block':this.metal(270,.065*v,pan);this.noiseHit(.08,.12*v,{band:500,pan});break;
      case 'cast':this.tone(pitch,.35,.08*v,{type:'triangle',end:pitch*2,pan,release:.2,reverb:.4});this.noiseHit(.3,.055*v,{band:pitch*3,pan});break;
      case 'reaction':case 'shatter':this.noiseHit(.55,.23*v,{band:4400,pan,q:.5});[1,1.5,2.1].forEach(m=>this.tone(pitch*m,.65,.08*v,{end:pitch*m*.4,pan,release:.5,reverb:.5}));this.tone(65,.42,.2*v,{end:28,pan});break;
      case 'thunder':case 'bossDeath':this.noiseHit(type==='bossDeath'?3.2:1.9,.65*v,{brown:true,filter:800,pan,attack:.02,release:1.6,reverb:.45});this.noiseHit(.21,.32*v,{band:2200,pan});this.tone(58,1.2,.3*v,{end:23,pan,release:1});break;
      case 'ultimate':case 'bond':{
        this.music.gain.setTargetAtTime(this.settings.music*.22,now,.09);this.music.gain.setTargetAtTime(this.settings.music,now+1.1,.5);
        const f=pitch/2;[1,1.5,2,3].forEach((m,i)=>this.tone(f*m,1.35,.065*v,{time:now+i*.08,end:f*m*2,attack:.13,release:.6,pan,reverb:.5,wave:this.choirWave,filter:2200}));
        this.tone(44,1.4,.22*v,{end:22,pan,attack:.03,release:1.1});break;}
      case 'heal':case 'absorb':case 'rune':case 'checkpoint':{
        const root=type==='rune'?220*2**((event.note||0)*2/12):type==='heal'?330:261.63;
        [1,1.25,1.5,2].forEach((m,i)=>this.tone(root*m,.8,.05*v,{time:now+i*.065,type:'sine',release:.72,pan,reverb:.5}));break;}
      case 'down':this.tone(180,.9,.18*v,{end:36,pan,release:.8});this.noiseHit(.55,.07*v,{brown:true,pan});break;
      default:break;
    }
  }
  bind(sim){
    for(const off of this.unsub)off();this.unsub=[];this.sim=sim;this.region=sim.mission.region||0;this.beat=0;this.nextBeat=(this.context?.currentTime||0)+.15;
    this.unsub.push(sim.on('audio',e=>this.sound(e)));this.targetIntensity=sim.world.isHub?0:.2;
    if(this.context){const now=this.context.currentTime,r=REGIONS[this.region];this.rainVolume.gain.setTargetAtTime(['rain','storm'].includes(r.weather)?.021:r.weather==='motes'?.003:.007,now,2);this.windFilter.frequency.setTargetAtTime(this.region===1?380:620,now,2);}
  }
  pad(chord,time,seconds){
    const c=this.context;if(!c)return;
    for(const [index,frequency] of chord.entries()){
      const gain=index===0?.026:.018;
      this.tone(frequency,seconds,gain,{time,wave:this.bowedWave,bus:this.music,attack:1.4,release:1.8,filter:750+this.intensity*650,reverb:.42,pan:(index-1.5)*.18,detune:index%2?4:-4});
      if(this.intensity>.4)this.tone(frequency*2,seconds,.01,{time,wave:this.choirWave,bus:this.music,attack:1.7,release:2,filter:1800,reverb:.5,pan:(index-1)*.22});
    }
  }
  musicBeat(time){
    const i=this.beat++,region=REGIONS[this.region],bass=region.music[Math.floor(i/16)%4],tempo=this.sim?.world.isHub?68:this.intensity>.65?100:82,quarter=60/tempo;
    if(i%16===0){const root=region.music[Math.floor(i/16)%4],third=root*(this.region===3?1.25:1.2);this.pad([root,root*2,third*2,root*3],time,quarter*8+2);}
    const motif=MOTIFS[this.region],semitone=motif[i%motif.length],note=region.music[0]*4*2**(semitone/12);
    if(i%2===0||this.intensity>.55){
      this.tone(note,quarter*(this.region===2?2.7:1.8),.018+this.intensity*.008,{time,type:'sine',bus:this.music,attack:.01,release:quarter*1.7,reverb:.55,pan:Math.sin(i*.6)*.25});
      this.tone(note*2,quarter*.65,.004,{time,type:'triangle',bus:this.music,attack:.005,release:quarter*.6,reverb:.3,filter:2500});
    }
    if(this.intensity>.23&&i%4===0){this.tone(bass*1.1,.5,.09*this.intensity,{time,bus:this.music,end:bass*.55,release:.48,reverb:.3});this.noiseHit(.16,.017*this.intensity,{time,bus:this.music,band:180,pan:0});}
    if(this.intensity>.55&&(i%4===2||i%16===15)){this.noiseHit(.12,.013,{time,bus:this.music,band:2200,q:.35,pan:i%2?.3:-.3});this.tone(bass*2,.2,.022,{time,bus:this.music,end:bass*.8,release:.18});}
    return quarter*.5;
  }
  update(dt){
    if(!this.started||this.context?.state!=='running')return;
    const enemies=this.sim?.enemies.filter(e=>!e.dead).length||0,boss=this.sim?.enemies.some(e=>!e.dead&&e.kind==='boss');
    this.targetIntensity=this.cinematic?.15:this.sim?.world.isHub?.05:boss?.95:enemies?Math.min(.8,.28+enemies*.03):.12;
    this.intensity+=(this.targetIntensity-this.intensity)*Math.min(1,dt*.4);
    const now=this.context.currentTime;
    if(this.nextBeat<now-.5)this.nextBeat=now+.06;
    let budget=0;while(this.nextBeat<now+.22&&budget++<6)this.nextBeat+=this.musicBeat(this.nextBeat);
    if(this.windFilter)this.windFilter.frequency.setTargetAtTime(500+Math.sin(now*.073)*160+this.intensity*240,now,.4);
  }
  setPaused(paused){this.paused=paused;this.applySettings(this.settings);}
  get diagnostics(){return{state:this.context?.state||'not-started',voices:this.voices.size,region:REGIONS[this.region].name,intensity:Number(this.intensity.toFixed(2)),status:this.status};}
  async dispose(){for(const off of this.unsub)off();this.unsub=[];this.wind?.stop();this.rain?.stop();for(const voice of this.voices)try{voice.stop();}catch{}await this.context?.close();}
}
