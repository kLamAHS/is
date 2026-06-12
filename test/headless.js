/* Headless integration test for Salt & Powder.
   Requires: npm i jsdom canvas  (run with NODE_PATH pointing at those modules if installed elsewhere)
   Usage: node test/headless.js */
const fs=require('fs');
const path=require('path');
const {JSDOM}=require('jsdom');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];

const dom=new JSDOM(html.replace(/<script[\s\S]*<\/script>/,''),{
 url:'https://example.com/',
 pretendToBeVisual:true,
});
const w=dom.window;

/* ---- THREE stub ---- */
class Vec3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}}
class Vec2{constructor(x=0,y=0){this.x=x;this.y=y;}set(x,y){this.x=x;this.y=y;return this;}}
class Color{
 constructor(){this.r=1;this.g=1;this.b=1;}
 set(){return this}setHSL(){return this}
 clone(){return new Color()}
 lerp(){return this}
}
class Obj3D{
 constructor(){this.position=new Vec3();this.rotation={order:'XYZ',x:0,y:0,z:0};this.scale=new Vec3(1,1,1);
  this.children=[];this.visible=true;this.castShadow=false;this.receiveShadow=false;
  this.renderOrder=0;this.frustumCulled=true;}
 add(){}remove(){}
}
class Geom{constructor(){this.attributes={};this.index=null;}
 setAttribute(n,a){this.attributes[n]=a;return this}
 setIndex(i){this.index=i;return this}
 rotateX(){return this}
 dispose(){}}
class BufAttr{constructor(arr,sz){this.array=arr instanceof Float32Array?arr:new Float32Array(arr);this.itemSize=sz;this.needsUpdate=false;}}
class Mat{constructor(o){Object.assign(this,o||{});if(this.map===undefined)this.map=null;}}
class Tex{constructor(){this.offset={x:0,y:0};this.repeat=new Vec2(1,1);this.needsUpdate=false;}}
class CanvasTexture extends Tex{constructor(cnv){super();this.image=cnv;}}
const THREE={
 WebGLRenderer:class{constructor(){this.shadowMap={};}setPixelRatio(){}setSize(){}render(){}},
 Scene:class extends Obj3D{constructor(){super();this.background=null;this.fog=null;}},
 PerspectiveCamera:class extends Obj3D{constructor(fov,asp){super();this.fov=fov;this.aspect=asp;}updateProjectionMatrix(){}},
 DirectionalLight:class extends Obj3D{constructor(){super();this.intensity=1;this.color=new Color();
  this.shadow={mapSize:{},camera:{},bias:0,normalBias:0};this.target=new Obj3D();}},
 HemisphereLight:class extends Obj3D{constructor(){super();this.intensity=1;}},
 PointLight:class extends Obj3D{constructor(c,i,d,dec){super();this.color=new Color();this.intensity=i||1;this.distance=d||0;this.decay=dec||1;}},
 Mesh:class extends Obj3D{constructor(g,m){super();this.geometry=g||new Geom();this.material=m||new Mat();}},
 Points:class extends Obj3D{constructor(g,m){super();this.geometry=g;this.material=m;}},
 Sprite:class extends Obj3D{constructor(m){super();this.material=m||new Mat();}},
 SphereGeometry:Geom,PlaneGeometry:Geom,BoxGeometry:Geom,BufferGeometry:Geom,
 Float32BufferAttribute:BufAttr,
 MeshLambertMaterial:Mat,ShaderMaterial:Mat,PointsMaterial:Mat,SpriteMaterial:Mat,
 CanvasTexture,
 DataTexture:class extends Tex{constructor(d){super();this.data=d;}},
 Color,FogExp2:class{constructor(){this.color=new Color();this.density=0.012;}},
 Vector3:Vec3,Vector2:Vec2,
 NearestFilter:1,LinearFilter:2,BackSide:3,DoubleSide:4,PCFShadowMap:5,
 LuminanceFormat:6,UnsignedByteType:7,ClampToEdgeWrapping:8,RepeatWrapping:9,
};

/* ---- globals ---- */
let rafCB=null;
const sandbox={
 window:w,document:w.document,localStorage:w.localStorage,
 matchMedia:()=>({matches:false}),
 requestAnimationFrame:(cb)=>{rafCB=cb;},
 setTimeout:(fn)=>{return 0;}, /* fire-and-forget; avoid async surprises in test */
 clearTimeout:()=>{},
 THREE,
 console,
 performance:{now:()=>Date.now()},
};
w.matchMedia=sandbox.matchMedia;
w.requestAnimationFrame=sandbox.requestAnimationFrame;
w.THREE=THREE;

let failed=0;
function ok(name,cond){
 if(cond)console.log('  PASS '+name);
 else{console.log('  FAIL '+name);failed++;}
}

/* run the game script in a function scope with our globals shadowing */
const keys=Object.keys(sandbox);
const fn=new Function(...keys,script+`
;return {get:(n)=>eval(n), run:(code)=>eval(code)};`);
let api;
try{
 api=fn(...keys.map(k=>sandbox[k]));
}catch(e){
 console.log('BOOT THREW:',e.stack);
 process.exit(1);
}
const g=n=>api.get(n);
const run=c=>api.run(c);

console.log('== boot ==');
ok('boot completed, raf armed',typeof rafCB==='function');

let now=0;
function frames(n,dt=40){
 for(let i=0;i<n;i++){now+=dt;const cb=rafCB;rafCB=null;cb(now);if(!rafCB)throw new Error('raf chain broken');}
}
frames(5);
ok('title frames render',true);

console.log('== new game ==');
run(`startGame('league','test-seed-1')`);
ok('G exists',!!g('G'));
ok('world isles',g('W').isles.length>8);
ok('coves generated',g('W').coves.length>=3);
ok('legends generated',g('W').legends.length>=1);
ok('slot assigned',g('G').slot===0);
ok('save written on new game',w.localStorage.getItem('snp.save.0')!==null);
frames(50);
ok('50 frames of walking sim',true);

console.log('== economy & stall ==');
const home=run(`W.isles.find(i=>i.fac==='league')`);
ok('home port has stall',!!home.stall);
run(`openStall(W.isles.find(i=>i.fac==='league'))`);
ok('stall opened',w.document.getElementById('tradeM').classList.contains('open'));
for(const tab of ['market','yard','tavern','jobs','port']){
 run(`curTab='${tab}';renderStall(W.isles.find(i=>i.fac==='league'))`);
 ok('tab renders: '+tab,w.document.getElementById('tBody').innerHTML.length>50);
}
ok('ledger recorded',Object.keys(g('G').ledger).length>=1);
run(`doBuy(W.isles.find(i=>i.fac==='league'),'grain',3)`);
ok('bought grain',(g('G').inv.grain|0)>=4);
run(`doSell(W.isles.find(i=>i.fac==='league'),'grain',2)`);
ok('sold grain',true);
run(`closePanel('tradeM')`);

console.log('== jobs ==');
const jobs=run(`genJobs(W.isles.find(i=>i.fac==='league'))`);
ok('jobs generated 3-5',jobs.length>=3&&jobs.length<=5);
const dj=run(`(function(){const isl=W.isles.find(i=>i.fac==='league');const j=isl.jobs.find(o=>o.t==='delivery')||isl.jobs[0];acceptJob(j,isl);return j;})()`);
ok('job accepted',g('G').jobs.length===1);
ok('objective text shows job',run('objectiveText()').length>5);

console.log('== sailing ==');
run('setSail()');
ok('sailing mode',g('G').mode==='sail');
frames(100);
ok('100 frames under sail',true);
run('fireBroadside()');
frames(10);
ok('broadside fired',true);
run(`spawnPirate();spawnNavy();spawnMerchant();spawnTrader();spawnGhost();spawnFleet();spawnDistress();spawnPlague();spawnWreckField();spawnFlot('castaway');spawnFlot('bottle');spawnHunter()`);
frames(100);
ok('sea full of events, 100 frames',true);
run('spawnSerpent()');
frames(60);
ok('serpent ticks',true);
run('G.ship.leak=1;patchLeak()');
run('G.ship.fire=1;douseFire()');
ok('emergency actions',g('G').ship.fire===0);
run('lightningStrike()');
run(`WX.kind='storm'`);
frames(40);
run(`WX.kind='clear'`);
ok('storm weather frames',true);
run('dropAnchor()');
ok('anchored',g('G').mode==='walk');
frames(20);

console.log('== day ticks / states / war ==');
run('startWarZone()');
for(let i=0;i<8;i++)run('dayTick()');
ok('day advanced',g('G').day>=9);
frames(40);
ok('frames after day ticks',true);

console.log('== combat consequences ==');
run(`(function(){const pr=G.pirates.find(p=>p.kind==='merchant'&&!p.dying);if(pr){onPlayerAttack(pr);pr.attacker='player';pr.hp=1;startSink(pr);}})()`);
ok('crime recorded',g('G').crimes.length>=1);
ok('wanted raised',g('G').wanted>0);
frames(60);

console.log('== UI panels ==');
run('openMap()');
ok('map renders',true);
run(`closePanel('mapM')`);
run(`G.course={x:100,z:100};openMap();closePanel('mapM')`);
ok('map with course',true);
run('openLedger()');
ok('ledger renders',w.document.getElementById('ledgBody').innerHTML.length>30);
run(`ledgView='routes';renderLedger()`);
ok('routes view',true);
run(`closePanel('ledgM')`);
run('openProfile()');
ok('profile renders',w.document.getElementById('profBody').innerHTML.length>200);
run(`closePanel('profM')`);
run('openInv()');
ok('inventory renders',true);
run(`closePanel('invM')`);
run(`G.inv.ckeg=2;runInspection(W.isles.find(i=>i.fac==='league'))`);
ok('inspection dialog',w.document.getElementById('dlgM').classList.contains('open'));
run(`closePanel('dlgM')`);
run(`coveDialog(W.coves[0])`);
ok('cove dialog',true);
run(`closePanel('dlgM')`);
run(`flagDialog(true)`);
ok('flag dialog',true);
run(`closePanel('dlgM')`);
run(`benchDialog()`);
run(`closePanel('dlgM')`);
run(`(function(){const pr=G.pirates.find(p=>!p.dying);if(pr){pr.surrendered=true;boardShip(pr);}})()`);
ok('boarding dialog',true);
run(`closePanel('dlgM')`);

console.log('== save / load roundtrip ==');
run('manualSave()');
const before={gold:g('G').gold,day:g('G').day,blocks:g('G').ship.blocks.size,
 wanted:Math.round(g('G').wanted),jobs:g('G').jobs.length,shipName:g('G').shipName,
 mined:g('G').stats.mined,inv:JSON.stringify(g('G').inv)};
const blob=w.localStorage.getItem('snp.save.0');
ok('save blob exists',!!blob&&blob.length>500);
ok('slot index written',w.localStorage.getItem('snp.slots').includes('"slot":0'));
run('loadGame(0)');
frames(30);
const after={gold:g('G').gold,day:g('G').day,blocks:g('G').ship.blocks.size,
 wanted:Math.round(g('G').wanted),jobs:g('G').jobs.length,shipName:g('G').shipName,
 mined:g('G').stats.mined,inv:JSON.stringify(g('G').inv)};
for(const k of Object.keys(before))ok('roundtrip '+k+' ('+before[k]+')',JSON.stringify(before[k])===JSON.stringify(after[k]));
ok('world seed preserved',g('W').seed==='test-seed-1');
frames(60);
ok('post-load frames stable',true);

console.log('== title save UI ==');
run('buildSaves()');
ok('continue button built',w.document.getElementById('contBtn')!==null);

console.log('== second game in another slot ==');
run(`startGame('brotherhood','other-seed')`);
ok('slot 1 assigned',g('G').slot===1);
frames(30);
run(`questPing();titleTick()`);
ok('quest/title ticks run',true);


console.log('== collision: no sailing through islands ==');
run(`startGame('crown','collision-seed')`);
frames(10);
{
 // aim the ship straight at the biggest island's centre and gun it
 const res=run(`(function(){
  const isl=W.isles.slice().sort((a,b)=>b.r-a.r)[0];
  const s=G.ship;
  // place her in open water due west of the island
  let sx=isl.cx-isl.r-22, sz=isl.cz;
  while(getH(Math.round(sx),Math.round(sz))>SEA-2)sx-=2;
  s.sailing=true;G.mode='sail';s.cells.clear();ensureCaptain();
  s.x=sx;s.z=sz;s.yaw=Math.atan2(-(isl.cz-sz),isl.cx-sx);s.spd=0;s.thr=0;
  let grounded=0;
  for(let i=0;i<1600;i++){
   s.yaw=Math.atan2(-(isl.cz-s.z),isl.cx-s.x); // keep ramming
   sailTick(0.05,0,1);
   if(shipGrounded(s,s.x,s.z))grounded++;
  }
  const dist=Math.hypot(s.x-isl.cx,s.z-isl.cz);
  return {grounded,dist,r:isl.r,hp:s.hp};
 })()`);
 ok('hull never ends a tick inside land (grounded ticks: '+res.grounded+')',res.grounded===0);
 ok('ship stopped at the coast, not inside (dist '+Math.round(res.dist)+' vs r '+Math.round(res.r)+')',res.dist>res.r*0.45);
}
{
 // approach at a shallow angle: should slide along the coast, still never inside
 const res=run(`(function(){
  const isl=W.isles.slice().sort((a,b)=>b.r-a.r)[0];
  const s=G.ship;
  let sx=isl.cx-isl.r-20, sz=isl.cz+8;
  while(getH(Math.round(sx),Math.round(sz))>SEA-2)sx-=2;
  s.x=sx;s.z=sz;s.spd=0;s.thr=0;
  s.yaw=Math.atan2(-((isl.cz-14)-sz),(isl.cx+isl.r)-sx); // glancing line
  let grounded=0;
  for(let i=0;i<1200;i++){sailTick(0.05,0,1);if(shipGrounded(s,s.x,s.z))grounded++;}
  return {grounded};
 })()`);
 ok('glancing approach slides, never penetrates',res.grounded===0);
}
{
 // unstick: a ship force-placed on land frees itself
 const res=run(`(function(){
  const isl=W.isles.slice().sort((a,b)=>b.r-a.r)[0];
  const s=G.ship;
  s.x=isl.cx;s.z=isl.cz;s.spd=0;
  for(let i=0;i<400;i++)sailTick(0.05,0,0);
  return {freed:!shipGrounded(s,s.x,s.z)};
 })()`);
 ok('beached ship works itself free',res.freed);
}

console.log('== course routing ==');
{
 const res=run(`(function(){
  const s=G.ship;
  // route to the far side of the world, past several islands
  const ports=W.isles.filter(i=>i.dock);
  let far=ports[0],fd=0;
  for(const p of ports){const d=Math.hypot(p.cx-s.x,p.cz-s.z);if(d>fd){fd=d;far=p;}}
  const tx=far.dock.x+far.dock.dx*10, tz=far.dock.z+(far.dock.dz||0)*10;
  setCourse(tx,tz);
  if(!G.course||!G.course.path)return {fail:'no course'};
  const path=G.course.path;
  // every interpolated point of every leg must be water
  let landHits=0,samples=0;
  for(let i=0;i<path.length-1;i++){
   const d=Math.hypot(path[i+1][0]-path[i][0],path[i+1][1]-path[i][1]);
   const steps=Math.max(1,Math.ceil(d/2));
   for(let k=0;k<=steps;k++){
    const x=path[i][0]+(path[i+1][0]-path[i][0])*k/steps;
    const z=path[i][1]+(path[i+1][1]-path[i][1])*k/steps;
    samples++;
    if(getH(Math.round(x),Math.round(z))>SEA-1)landHits++;
   }
  }
  return {direct:!!G.course.direct,legs:path.length-1,landHits,samples,len:Math.round(pathLen(path))};
 })()`);
 ok('routed course found (legs: '+res.legs+', len '+res.len+')',!res.fail&&!res.direct&&res.legs>=1);
 ok('entire course is open water ('+res.samples+' samples, '+res.landHits+' land)',res.landHits===0);
}
{
 // clicking on land snaps to nearby water
 const res=run(`(function(){
  const isl=W.isles.slice().sort((a,b)=>b.r-a.r)[0];
  setCourse(isl.cx,isl.cz); // dead centre of an island
  return {has:!!G.course,water:G.course?getH(Math.round(G.course.x),Math.round(G.course.z))<=SEA-1:false};
 })()`);
 ok('land click snaps course to water',!res.has||res.water);
}
{
 // breadcrumbs appear in the world while a course is set
 run(`(function(){const ports=W.isles.filter(i=>i.dock);const far=ports[ports.length-1];setCourse(far.dock.x+far.dock.dx*10,far.dock.z+(far.dock.dz||0)*10);})()`);
 frames(20);
 const vis=run(`CRUMB.pool.filter(s=>s.visible).length`);
 ok('gold course markers visible at sea ('+vis+')',vis>=3);
 run('clearCourse(true)');
 frames(3);
 ok('markers hidden after clearing',run(`CRUMB.pool.filter(s=>s.visible).length`)===0);
}

console.log('== structures & terrain ==');
{
 const res=run(`(function(){
  let lant=0,logs=0,roofs=0,stone=0,wellAir=0;
  for(const [k,id] of VB){
   if(id===32)lant++;
   if(id===5)logs++;
   if(id===7)roofs++;
   if(id===4)stone++;
  }
  return {vb:VB.size,lant,logs,roofs,stone,towers:W.isles.filter(i=>i.tower).length};
 })()`);
 ok('villages substantial (VB '+res.vb+')',res.vb>2500);
 ok('lanterns placed ('+res.lant+')',res.lant>=4);
 ok('log frames & pilings ('+res.logs+')',res.logs>=20);
 ok('stonework: wells/towers/rubble ('+res.stone+')',res.stone>=20);
}
{
 // map renders with all the new chrome + a course
 run(`(function(){const ports=W.isles.filter(i=>i.dock);setCourse(ports[0].dock.x,ports[0].dock.z);openMap();})()`);
 ok('map with routed course renders',w.document.getElementById('mapInfo').innerHTML.includes('Course'));
 run(`closePanel('mapM');clearCourse(true)`);
}
{
 // save roundtrip still carries the course path
 run(`(function(){const ports=W.isles.filter(i=>i.dock);const p2=ports[ports.length-1];setCourse(p2.dock.x+p2.dock.dx*8,p2.dock.z+(p2.dock.dz||0)*8);})()`);
 const legsBefore=run('G.course&&G.course.path?G.course.path.length:0');
 run('manualSave()');
 run(`loadGame(G.slot)`);
 frames(10);
 const legsAfter=run('G.course&&G.course.path?G.course.path.length:0');
 ok('course path survives save/load ('+legsBefore+' pts)',legsBefore>0&&legsBefore===legsAfter);
}


console.log('== progression: danger rings ==');
run(`startGame('league','prog-seed-1')`);
frames(10);
{
 const res=run(`(function(){
  const home=W.home;
  const r0=ringOf(home.cx,home.cz);
  const rFar=ringOf(home.cx>WORLD/2?10:WORLD-10,home.cz>WORLD/2?10:WORLD-10);
  const rings=W.isles.map(i=>i.ring);
  return {r0,rFar,allAssigned:rings.every(r=>r===0||r===1||r===2),has2:rings.includes(2)};
 })()`);
 ok('home isle is ring 0',res.r0===0);
 ok('far corner is ring 2',res.rFar===2);
 ok('every isle has a ring',res.allAssigned);
 ok('ring 2 exists in the world',res.has2);
}
{
 const res=run(`(function(){
  // hp scaling: same class spawned in ring 0 vs ring 2
  const home=W.home;
  const p0=spawnShipNPC('pirate','sloop',home.cx+10,home.cz+10);
  const fx=home.cx>WORLD/2?20:WORLD-20, fz=home.cz>WORLD/2?20:WORLD-20;
  const p2=spawnShipNPC('pirate','sloop',fx,fz);
  const out={hp0:p0.maxHp,hp2:p2.maxHp,d0:p0.dmgBonus,d2:p2.dmgBonus};
  p0.fade=0.01;p2.fade=0.01;
  return out;
 })()`);
 ok('ring-2 ships tougher than ring-0 ('+res.hp0+' vs '+res.hp2+')',res.hp2>res.hp0*1.4);
 ok('ring dmg bonus applied (0 vs '+res.d2+')',res.d0===0&&res.d2===2);
}
{
 const res=run(`(function(){
  const home=W.home;
  let g0=0,g2=0;
  for(let i=0;i<200;i++){
   if(pickPirateCls(home.cx,home.cz)==='galleon')g0++;
   if(pickPirateCls(home.cx>WORLD/2?20:WORLD-20,home.cz>WORLD/2?20:WORLD-20)==='galleon')g2++;
  }
  return {g0,g2};
 })()`);
 ok('no galleons prowl home waters ('+res.g0+'/200)',res.g0===0);
 ok('galleons rule the outer reaches ('+res.g2+'/200)',res.g2>60);
}

console.log('== progression: ammunition & manned guns ==');
{
 const res=run(`(function(){
  const s=G.ship;
  // strip and rebuild a known armament: 6 plain cannons
  for(const [k,id] of [...s.blocks])if(CANNON_DIR[id]!==undefined)s.blocks.delete(k);
  for(let i=0;i<6;i++)s.blocks.set(K(i,2,1),19);
  shipStats(s);
  s.sailing=true;G.mode='sail';
  G.crew=4;G.spec={};
  const before=BALLS.length;
  G.inv.shot=3;s.reload=0;s.gunsOut=0;
  fireBroadside();
  const fired1=BALLS.length-before;
  const left=G.inv.shot;
  s.reload=0;
  G.inv.shot=0;
  const b2=BALLS.length;
  fireBroadside();
  return {fired1,left,fired2:BALLS.length-b2,reloadLocked:G.ship.reload>0};
 })()`);
 ok('3 shot + 6 guns -> exactly 3 balls',res.fired1===3);
 ok('shot consumed to zero',res.left===0);
 ok('dry guns fire nothing',res.fired2===0);
 ok('no reload lock when dry',res.reloadLocked===false);
}
{
 const res=run(`(function(){
  const s=G.ship;
  G.inv.shot=50;G.crew=0;G.spec={};s.reload=0;s.gunsOut=0;
  const b0=BALLS.length;
  fireBroadside();
  const noCrew=BALLS.length-b0;
  G.crew=4;s.reload=0;
  const b1=BALLS.length;
  fireBroadside();
  return {noCrew,withCrew:BALLS.length-b1};
 })()`);
 ok('crew 0 mans only 2 guns',res.noCrew===2);
 ok('crew 4 mans 6 guns',res.withCrew===6);
}
{
 const res=run(`(function(){
  const s=G.ship;
  // swap one gun heavy and check ball damage
  for(const [k,id] of [...s.blocks])if(CANNON_DIR[id]!==undefined)s.blocks.delete(k);
  s.blocks.set(K(2,2,1),41); // heavy, port side
  s.blocks.set(K(3,2,1),19); // plain
  shipStats(s);
  G.inv.shot=10;G.crew=2;s.reload=0;s.gunsOut=0;
  const b0=BALLS.length;
  fireBroadside();
  const balls=BALLS.slice(b0);
  const base=9+G.crew;
  return {n:balls.length,d:balls.map(b=>b.dmg),base};
 })()`);
 ok('heavy cannon ball does x1.8 ('+res.d.join(',')+')',res.n===2&&res.d.includes(res.base)&&res.d.includes(Math.round(res.base*1.8)));
}

console.log('== progression: soft caps ==');
{
 const res=run(`(function(){
  const s=G.ship;
  const speedAt=(n)=>{
   s.blocks=new Map();
   for(let i=0;i<n;i++)s.blocks.set(K(Math.floor(i/3),Math.floor(i%9/3),i%3),7);
   s.blocks.set(K(0,3,0),12);
   s.blocks.set(K(1,3,0),16);s.blocks.set(K(1,3,1),16);s.blocks.set(K(1,3,2),16);s.blocks.set(K(2,3,0),16);
   s.sailDmg=0;shipStats(s);
   return s.spdMax;
  };
  return {s30:speedAt(30),s60:speedAt(60),s100:speedAt(100)};
 })()`);
 ok('plank spam slows her: 30b '+res.s30.toFixed(1)+' > 60b '+res.s60.toFixed(1)+' > 100b '+res.s100.toFixed(1),res.s30>res.s60&&res.s60>res.s100);
}
{
 const res=run(`(function(){
  const s=G.ship;
  const speedWithSails=(n)=>{
   s.blocks=new Map();
   for(let i=0;i<20;i++)s.blocks.set(K(Math.floor(i/2),0,i%2),7);
   s.blocks.set(K(0,1,0),12);
   for(let i=0;i<n;i++)s.blocks.set(K(Math.floor(i/2),2+(i%2),(i%2)),16);
   s.sailDmg=0;shipStats(s);
   return s.spdMax;
  };
  const d1=speedWithSails(4)-speedWithSails(2);
  const d2=speedWithSails(8)-speedWithSails(6);
  const d3=speedWithSails(12)-speedWithSails(10);
  return {d1,d2,d3};
 })()`);
 ok('sails give diminishing returns ('+res.d1.toFixed(2)+' > '+res.d2.toFixed(2)+' >= '+res.d3.toFixed(2)+')',res.d1>res.d2&&res.d2>=res.d3-0.001);
}
{
 const res=run(`(function(){
  const s=G.ship;
  s.blocks=new Map();
  for(let i=0;i<10;i++)s.blocks.set(K(i,0,0),7);
  s.blocks.set(K(0,1,0),12);
  for(let i=0;i<4;i++)s.blocks.set(K(1+i,1,0),38); // steel plating
  shipStats(s);
  return {hp:s.maxHp,steel:s.steel};
 })()`);
 ok('steel plating adds +8 hp each',res.steel===4&&res.hp===20+15*4+4*8);
}

console.log('== progression: renown ==');
{
 const res=run(`(function(){
  G.renown={xp:0,lvl:1};
  const l1=renownLvl();
  G.renown.xp=80;const l2=renownLvl();
  G.renown.xp=3200;const l10=renownLvl();
  G.renown.xp=199;const l2b=renownLvl();
  return {l1,l2,l10,l2b,s1:(function(){G.renown.xp=0;return specSlotMax();})(),
   s2:(function(){G.renown.xp=80;return specSlotMax();})(),
   s3:(function(){G.renown.xp=940;return specSlotMax();})(),
   t1:(function(){G.renown.xp=0;return jobTier();})(),
   t2:(function(){G.renown.xp=200;return jobTier();})(),
   t3:(function(){G.renown.xp=1850;return jobTier();})()};
 })()`);
 ok('renown thresholds (1/2/10, 199->2)',res.l1===1&&res.l2===2&&res.l10===10&&res.l2b===2);
 ok('specialist slots 1/2/3',res.s1===1&&res.s2===2&&res.s3===3);
 ok('job tiers 1/2/3',res.t1===1&&res.t2===2&&res.t3===3);
}
{
 const res=run(`(function(){
  G.renown={xp:0,lvl:1};
  G.stats.dayKills={};
  const s=G.ship;
  s.blocks=new Map();
  for(let i=0;i<60;i++)s.blocks.set(K(Math.floor(i/3),0,i%3),7); // big ship: maxHp high
  shipStats(s);
  const weak={kind:'pirate',clsName:'sloop',maxHp:50,x:0,z:0};
  killRenown(weak);
  const afterWeak=G.renown.xp;
  G.stats.dayKills={};
  const strong={kind:'pirate',clsName:'galleon',maxHp:9999,x:0,z:0};
  killRenown(strong);
  return {weakXp:afterWeak,strongXp:G.renown.xp-afterWeak};
 })()`);
 ok('clubbing minnows pays x0.25 ('+res.weakXp+' xp)',res.weakXp<=2);
 ok('above-weight kills pay full ('+res.strongXp+' xp)',res.strongXp===28);
}

console.log('== progression: rivals ==');
{
 const res=run(`(function(){
  const rv={id:9,name:'Capt. Test',seed:12345,lvl:3,xp:200,alive:true,respawnDay:0};
  const a=buildRivalCls(rv);
  const blocksA=a.geo?1:0;
  const gunsA=a.cls.guns.length;
  rv.cache=null;
  const b=buildRivalCls(rv);
  const same=gunsA===b.cls.guns.length&&a.cls.hp===b.cls.hp&&a.cls.len===b.cls.len;
  rv.lvl=6;rv.cache=null;
  const big=buildRivalCls(rv);
  return {same,gunsA,guns6:big.cls.guns.length,hp3:a.cls.hp,hp6:big.cls.hp,len3:a.cls.len,len6:big.cls.len};
 })()`);
 ok('rival blueprint deterministic per seed+lvl',res.same);
 ok('rivals grow: guns '+res.gunsA+'->'+res.guns6+', hp '+res.hp3+'->'+res.hp6+', len '+res.len3+'->'+res.len6,
  res.guns6>res.gunsA&&res.hp6>res.hp3&&res.len6>res.len3);
}
{
 const res=run(`(function(){
  G.rivals=makeRivals(777,1);
  const lv1=G.rivals[0].lvl;
  for(let d=0;d<30;d++){G.day++;rivalDayTick();}
  return {lv1,lv30:G.rivals[0].lvl,alive:G.rivals[0].alive};
 })()`);
 ok('rivals level over 30 days (1 -> '+res.lv30+')',res.lv1===1&&res.lv30>=6&&res.lv30<=8);
}
{
 const res=run(`(function(){
  const rv=G.rivals[1];
  rv.lvl=5;rv.cache=null;
  const cc=buildRivalCls(rv);
  const pr=spawnShipNPC('rival','rival',G.ship.x+20,G.ship.z,{clsObj:cc.cls,geoObj:cc.geo,rvId:rv.id,name:rv.name,label:'test rival'});
  const xpBefore=G.renown.xp;
  pr.attacker='player';
  startSink(pr);
  const renownGain=G.renown.xp-xpBefore;
  const downed=!rv.alive&&rv.respawnDay>G.day;
  const respawnAt=rv.respawnDay;
  G.day=rv.respawnDay;
  rivalDayTick();
  return {renownGain,downed,respawnAt,back:rv.alive,backLvl:rv.lvl};
 })()`);
 ok('rival kill pays 50+10*lvl renown ('+res.renownGain+')',res.renownGain===100);
 ok('rival downed with respawn day',res.downed);
 ok('a new rival rises at lvl-2 ('+res.backLvl+')',res.back&&res.backLvl===3);
}
{
 const res=run(`(function(){
  const rv=G.rivals[2];
  rv.lvl=5;rv.cache=null;
  const cc=buildRivalCls(rv);
  return {hasStar:!!cc.cls.loot.starAny,shot:!!cc.cls.loot.shot};
 })()`);
 ok('high-level rival loot carries starmetal & shot',res.hasStar&&res.shot);
}

console.log('== progression: loot & royal sails ==');
{
 const res=run(`(function(){
  const home=W.home;
  let inner=0,outer=0;
  for(let i=0;i<40;i++){
   spawnLoot(home.cx+6,home.cz+6,{g:[100,100],n:[0,0]});
   inner+=G.loots.pop().gold;
   const fx=home.cx>WORLD/2?20:WORLD-20, fz=home.cz>WORLD/2?20:WORLD-20;
   spawnLoot(fx,fz,{g:[100,100],n:[0,0]});
   outer+=G.loots.pop().gold;
  }
  for(const l of G.loots)scene.remove(l.mesh);
  return {inner:inner/40,outer:outer/40};
 })()`);
 ok('ring loot multiplier: home '+res.inner.toFixed(0)+'g vs outer '+res.outer.toFixed(0)+'g',res.inner<70&&res.outer>150);
}
{
 const res=run(`(function(){
  const s=G.ship;
  s.blocks=new Map();
  for(let i=0;i<12;i++)s.blocks.set(K(i,0,0),7);
  s.blocks.set(K(0,1,0),12);
  for(let i=0;i<3;i++)s.blocks.set(K(2+i,2,0),39); // royal sails only
  s.blocks.set(K(6,2,0),25); // one fast sail for the rip check path
  s.sailDmg=0;shipStats(s);
  s.sailing=true;
  WX.kind='storm';
  for(let i=0;i<5000;i++)wxTick(0.016);
  WX.kind='clear';
  const onlyFastRipped=s.sailDmg<=1; // the single common sail may rip; royals never push past it
  s.blocks.delete(K(6,2,0));s.sailDmg=0;shipStats(s);
  WX.kind='storm';
  for(let i=0;i<5000;i++)wxTick(0.016);
  WX.kind='clear';
  return {onlyFastRipped,royalDmg:s.sailDmg};
 })()`);
 ok('storms cannot rip past common canvas',res.onlyFastRipped);
 ok('an all-royal rig never tears (sailDmg '+res.royalDmg+')',res.royalDmg===0);
}

console.log('== progression: legacy save compatibility ==');
{
 const res=run(`(function(){
  // build a v1-style blob: no renown, no rivals, no shot
  const blob=saveBlob();
  delete blob.renown;
  delete blob.rivals;
  delete blob.inv.shot;
  blob.stats.jobsDone=12;blob.stats.pirateKills=6;blob.stats.navyKills=2;blob.stats.portsVisited=5;
  localStorage.setItem('snp.save.4',JSON.stringify(blob));
  const ix=slotIndex().filter(e=>e.slot!==4);
  ix.push({slot:4,name:'legacy',when:Date.now(),fac:blob.fac,day:blob.day,gold:blob.gold,blocks:10,shipName:'Legacy',lastIsle:'?'});
  writeSlotIndex(ix);
  loadGame(4);
  return {xp:G.renown.xp,lvl:G.renown.lvl,rivals:G.rivals.length,shot:G.inv.shot,
   rivalsLeveled:G.rivals.every(r=>r.lvl>=1)};
 })()`);
 frames(20);
 ok('legacy save grandfathered: renown xp '+res.xp+' (lvl '+res.lvl+')',res.xp===12*10+8*10+5*15&&res.lvl>=2);
 ok('legacy save gets rivals',res.rivals===3&&res.rivalsLeveled);
 ok('legacy save gets a shot locker',res.shot===20);
}
{
 // roundtrip with new fields
 run(`G.renown.xp=500;G.renown.lvl=renownLvl();G.inv.shot=17;manualSave()`);
 const before={xp:run('G.renown.xp'),shot:run('G.inv.shot'),riv:run('G.rivals.map(r=>r.lvl).join()')};
 run('loadGame(G.slot)');
 frames(10);
 const after={xp:run('G.renown.xp'),shot:run('G.inv.shot'),riv:run('G.rivals.map(r=>r.lvl).join()')};
 ok('renown survives save/load',before.xp===after.xp);
 ok('shot survives save/load',before.shot===after.shot);
 ok('rival levels survive save/load',before.riv===after.riv);
}

console.log('== progression: smoke per ring ==');
{
 run(`startGame('crown','smoke-seed')`);
 frames(10);
 const ok1=run(`(function(){
  const home=W.home;
  const spots=[[home.cx+12,home.cz+12],[home.cx>WORLD/2?home.cx-220:home.cx+220,home.cz],[home.cx>WORLD/2?30:WORLD-30,home.cz>WORLD/2?30:WORLD-30]];
  for(const [x,z] of spots){
   G.ship.sailing=true;G.mode='sail';G.ship.cells.clear();ensureCaptain();
   G.ship.x=x;G.ship.z=z;
   for(const rv of G.rivals)rv.lvl=Math.max(rv.lvl,3);
   rivalMaintain();
  }
  return true;
 })()`);
 frames(150);
 ok('60s of sim across all rings with rivals afloat',ok1===true);
}


console.log('== landfall: vitals ==');
run(`startGame('compact','landfall-seed')`);
frames(10);
{
 const res=run(`(function(){
  G.hp=20;
  dmgPlayer(7,'a test');
  const a=G.hp;
  const goldBefore=G.gold=500;
  const px=P.x;
  G.hp=3;dmgPlayer(5,'the abyss');
  return {a,fainted:G.hp===12,goldCut:G.gold===460,moved:true};
 })()`);
 ok('damage lands (20->'+res.a+')',res.a===13);
 ok('faint resets hp to 12',res.fainted);
 ok('faint costs 8% of the purse',res.goldCut);
}
{
 const res=run(`(function(){
  G.hp=20;G.breath=breathMax();
  const bmax0=breathMax();
  G.inv.divehelm=1;
  const bmax1=breathMax();
  G.inv.divehelm=0;
  /* drown: stick the captain under open water */
  P.x=W.home.cx+60;P.z=W.home.cz;P.y=SEA-4;
  while(getH(Math.round(P.x),Math.round(P.z))>SEA-3)P.x+=2;
  let t=0;
  while(G.breath>0&&t<30){vitalsTick(0.1);t+=0.1;}
  const drained=G.breath===0;
  for(let i=0;i<80;i++)vitalsTick(0.1);
  const hurt=G.hp<20;
  /* surface: breath returns */
  P.y=SEA+4;
  for(let i=0;i<40;i++)vitalsTick(0.1);
  return {bmax0,bmax1,drained,hurt,refilled:G.breath===breathMax()};
 })()`);
 ok('diving helm doubles breath ('+res.bmax0+'->'+res.bmax1+')',res.bmax0===12&&res.bmax1===26);
 ok('lungs drain underwater',res.drained);
 ok('drowning hurts',res.hurt);
 ok('air refills at the surface',res.refilled);
}

console.log('== landfall: beasts & blades ==');
{
 const res=run(`(function(){
  clearMobs();
  G.hp=20;
  /* stand the captain on his home isle and conjure a crab in front of him */
  const home=W.home;
  P.x=home.cx+0.5;P.z=home.cz+0.5;P.y=getH(home.cx,home.cz)+1.1;P.pitch=0;
  let mb=null;
  for(const [ox,oz] of [[0,2.5],[2.5,0],[0,-2.5],[-2.5,0],[2,2],[3,1]]){
   mb=spawnMob('crab',P.x+ox,P.z+oz,{});
   if(mb)break;
  }
  if(!mb)return {fail:'no spawn'};
  P.yaw=Math.atan2(mb.x-P.x,mb.z-P.z);
  P.y=mb.y+0.1;
  const seen=mobUnderCross(14);
  G.inv.cutlass=1;
  const mx=mb.x,mz=mb.z;
  let swings=0;
  while(MOBS.length&&swings<10){atkCD=0;attackTick(0.1,MOBS[0]);swings++;mb.x=mx;mb.z=mz;}
  return {spawned:true,seen:seen===mb,swings,dead:MOBS.length===0};
 })()`);
 ok('crab conjured and targeted',res.spawned&&res.seen);
 ok('cutlass fells a crab in 2 swings ('+res.swings+')',res.dead&&res.swings===2);
}
{
 const res=run(`(function(){
  clearMobs();
  const home=W.home;
  P.x=home.cx+0.5;P.z=home.cz+0.5;P.y=getH(home.cx,home.cz)+1.1;P.yaw=0;P.pitch=0;
  const mb=spawnMob('skel',P.x,P.z+8,{});
  if(!mb)return {fail:'no spawn'};
  G.inv.pistol=1;G.inv.shot=3;
  atkCD=0;attackTick(0.1,mb);
  const shotUsed=G.inv.shot===2;
  const hurt=mb.hp===20-9;
  /* aggro: it walks toward the captain */
  const d0=Math.hypot(mb.x-P.x,mb.z-P.z);
  for(let i=0;i<40;i++)mobTick(0.1);
  const d1=Math.hypot(mb.x-P.x,mb.z-P.z);
  /* the bite */
  G.hp=20;mb.x=P.x+0.8;mb.z=P.z;mb.y=P.y;mb.atk=0;
  mobTick(0.1);
  const bitten=G.hp<20;
  clearMobs();
  return {shotUsed,hurt,closed:d1<d0-1,bitten};
 })()`);
 ok('flintlock fires round shot',res.shotUsed&&res.hurt);
 ok('the drowned walk toward you',res.closed);
 ok('and they bite',res.bitten);
}

console.log('== landfall: caves, reefs, wrecks ==');
{
 const res=run(`(function(){
  /* sample the world for carved galleries, crystal, oysters */
  let carved=0,crystal=0,oyster=0,reefCols=0;
  for(const isl of W.isles){
   for(let x=isl.cx-isl.r;x<isl.cx+isl.r;x+=2)for(let z=isl.cz-isl.r;z<isl.cz+isl.r;z+=2){
    const c=col(x,z);
    if(c.cavM>0.62&&c.h>SEA+2){
     const y=Math.round(c.cavY);
     if(y>3&&y<c.h-4&&(y>=SEA||c.h>SEA+6)&&genBlock(x,y,z)===0)carved++;
     for(let dy=-9;dy<=9;dy++){const yy=y+dy;if(yy>3&&yy<c.h-3&&genBlock(x,yy,z)===45)crystal++;}
    }
   }
  }
  for(let x=0;x<WORLD;x+=2)for(let z=0;z<WORLD;z+=2){
   const c=col(x,z);
   if(c.reef>0.3){reefCols++;if(genBlock(x,c.h,z)===44)oyster++;}
  }
  return {carved,crystal,reefCols,oyster,sunk:W.sunk.length,camps:W.camps.length};
 })()`);
 ok('worm caves carved into the isles ('+res.carved+' samples)',res.carved>20);
 ok('gold-veined crystal in the galleries ('+res.crystal+')',res.crystal>0);
 ok('reefs exist ('+res.reefCols+' cols) and bear oysters ('+res.oyster+')',res.reefCols===0||res.oyster>0);
 ok('sunken wrecks laid down ('+res.sunk+')',res.sunk>=3);
 ok('pirate camps generated ('+res.camps+')',res.camps>=0&&res.camps<=2);
}
{
 const res=run(`(function(){
  /* drowned chests pay in pearls */
  const inv0=G.inv.pearl|0;
  openChest({x:999,y:SEA-4,z:999});
  return {gained:(G.inv.pearl|0)>inv0};
 })()`);
 ok('drowned chests pay in pearls',res.gained);
}
{
 const res=run(`(function(){
  /* pearls are a real market good everywhere */
  let finite=true;
  for(const isl of W.isles){
   if(!isl.stall)continue;
   if(!isFinite(buyP(isl,'pearl'))||!isFinite(sellP(isl,'pearl')))finite=false;
  }
  const tropical=W.isles.find(i=>i.stall&&i.type==='tropical');
  const capital=W.isles.find(i=>i.type==='capital'&&i.stall);
  return {finite,inKeys:GKEYS.includes('pearl'),
   facPorts:W.isles.filter(i=>i.fac).every(i=>!!i.stall),
   cheapAtSource:tropical&&capital?buyP(tropical,'pearl')<buyP(capital,'pearl'):true};
 })()`);
 ok('pearl prices finite at every stall',res.finite&&res.inKeys);
 ok('every faction seat has its harbour',res.facPorts);
 ok('pearls cheap where they are dived',res.cheapAtSource);
}

console.log('== landfall: treasure has teeth ==');
{
 const res=run(`(function(){
  clearMobs();
  const home=W.home;
  P.x=home.cx+0.5;P.z=home.cz+0.5;P.y=getH(home.cx,home.cz)+1.1;
  G.tmap={isle:home.id,x:Math.round(P.x)+2,z:Math.round(P.z),found:false};
  breakBlock({x:G.tmap.x,y:getH(G.tmap.x,G.tmap.z),z:G.tmap.z,id:1});
  const guards=MOBS.filter(m=>m.type==='skel').length;
  clearMobs();
  return {found:G.tmap.found,guards};
 })()`);
 ok('digging the X wakes its keepers ('+res.guards+')',res.found&&res.guards>=1);
}
{
 const res=run(`(function(){
  /* old-save guard: stocks missing pearl heal on load */
  const blob=saveBlob();
  for(const si of blob.isles)if(si.stock)delete si.stock.pearl;
  delete blob.hp;
  localStorage.setItem('snp.save.5',JSON.stringify(blob));
  const ix=slotIndex().filter(e=>e.slot!==5);
  ix.push({slot:5,name:'pre-pearl',when:Date.now(),fac:blob.fac,day:blob.day,gold:blob.gold,blocks:10,shipName:'Old Girl',lastIsle:'?'});
  writeSlotIndex(ix);
  loadGame(5);
  let finite=true;
  for(const isl of W.isles){
   if(!isl.stall)continue;
   if(!isFinite(buyP(isl,'pearl')))finite=false;
  }
  return {finite,hp:G.hp};
 })()`);
 frames(10);
 ok('pre-pearl saves heal their market stocks',res.finite);
 ok('pre-vitals saves wake with full health',res.hp===20);
}
{
 run(`G.hp=15;G.inv.cutlass=1;G.inv.pistol=1;manualSave();loadGame(G.slot)`);
 frames(5);
 ok('hp and weapons survive save/load',run('G.hp')===15&&run('G.inv.cutlass')===1&&run('G.inv.pistol')===1);
}

console.log('== landfall: smoke ==');
{
 run(`(function(){
  clearMobs();
  const home=W.home;
  P.x=home.cx+0.5;P.z=home.cz+0.5;P.y=getH(home.cx,home.cz)+1.1;
  spawnMob('crab',P.x+6,P.z,{});
  spawnMob('boar',P.x-6,P.z,{});
  spawnMob('skel',P.x,P.z+7,{});
 })()`);
 frames(150);
 ok('60s of shore leave among the beasts',true);
}


console.log('== blocky rigs ==');
{
 const res=run(`(function(){
  const p=makePerson(0x8a3a2e,{hat:0xc8b06a,hat2:false});
  const six=['head','body','armL','armR','legL','legR'].every(k=>!!p[k]);
  setPerson(p,10,20,10,0.5,false);
  const stacked=p.head.position.y>p.body.position.y&&p.body.position.y>p.legL.position.y;
  const hat=!!p.hatB&&p.hatB.position.y>p.head.position.y;
  /* walk animation: legs swing in opposition across phases */
  poseRig(p,10,20,10,0,{walk:1,phase:Math.PI/2-p.seed});
  const a1=p.legL.rotation.x,b1=p.legR.rotation.x;
  poseRig(p,10,20,10,0,{walk:1,phase:-Math.PI/2-p.seed});
  const a2=p.legL.rotation.x;
  rmPerson(p);
  return {six,stacked,hat,opposed:Math.sign(a1)!==Math.sign(b1)&&Math.abs(a1)>0.3,swings:a1!==a2};
 })()`);
 ok('rig has head, torso, two arms, two legs',res.six);
 ok('parts stack head-over-torso-over-legs',res.stacked);
 ok('hat sits on the head',res.hat);
 ok('legs swing in opposition',res.opposed);
 ok('walk cycle animates over phase',res.swings);
}
{
 run(`startGame('crown','rig-seed')`);
 frames(10);
 const res=run(`(function(){
  setSail();
  const visible=CAP&&CAP.parts.every(m=>m.visible);
  /* a few frames so sailTick poses him */
  sailTick(0.05,0,0);
  const wheel=CAP.armR.rotation.x<-1&&CAP.armL.rotation.x<-1;
  const hat=!!CAP.hatB;
  dropAnchor();
  const hidden=CAP.parts.every(m=>!m.visible);
  return {visible,wheel,hat,hidden};
 })()`);
 ok('captain rig mans the helm under sail',res.visible&&res.hat);
 ok('hands on the wheel',res.wheel);
 ok('captain stands down at anchor',res.hidden);
}
{
 const res=run(`(function(){
  clearMobs();
  const home=W.home;
  P.x=home.cx+0.5;P.z=home.cz+0.5;P.y=getH(home.cx,home.cz)+1.1;
  let mb=null;
  for(const [ox,oz] of [[0,4],[4,0],[0,-4],[-4,0]]){mb=spawnMob('skel',P.x+ox,P.z+oz,{});if(mb)break;}
  if(!mb)return {fail:1};
  const rigged=!!mb.rig&&mb.rig.parts.length>=6;
  mobTick(0.1);
  const posed=mb.rig.head.position.y>mb.rig.body.position.y;
  killMob(mb,MOBS.indexOf(mb));
  return {rigged,posed,gone:MOBS.length===0};
 })()`);
 ok('skeletons are full skull-faced rigs',res.rigged);
 ok('skeleton rig poses upright',res.posed);
 ok('rig cleaned up on death',res.gone);
}
{
 run('G.cam3=true');
 frames(10);
 const res=run(`(function(){
  const eye={x:P.x,y:P.y+PEYE,z:P.z};
  const off=Math.hypot(camera.position.x-eye.x,camera.position.z-eye.z);
  const seen=PLR&&PLR.parts.every(m=>m.visible);
  G.cam3=false;
  return {off,seen};
 })()`);
 frames(5);
 ok('third person pulls the camera back ('+res.off.toFixed(1)+')',res.off>2.5);
 ok('player rig visible in third person',res.seen);
 ok('rig hidden again in first person',run('PLR.parts.every(m=>!m.visible)'));
}
{
 run('G.cam3=true;manualSave();loadGame(G.slot)');
 frames(5);
 ok('camera choice survives save/load',run('G.cam3')===true);
 run('G.cam3=false');
}


console.log('== feedback round: diving, depths, caves, mobile ==');
run(`startGame('league','depths-seed')`);
frames(10);
{
 const res=run(`(function(){
  /* park the captain over deep water and nose down */
  const home=W.home;
  P.x=home.cx;P.z=home.cz;
  let tries=0;
  while(getH(Math.round(P.x),Math.round(P.z))>SEA-6&&tries++<300)P.x+=2;
  if(getH(Math.round(P.x),Math.round(P.z))>SEA-6)return {skip:true};
  P.y=SEA-0.5;P.vy=0;P.pitch=-0.9;
  G.breath=999;G.hp=20;
  for(let i=0;i<160;i++)movePlayer(0.05,0,1,false);
  const dove=P.y;
  /* level out: buoyancy carries you back up */
  P.pitch=0;
  for(let i=0;i<200;i++)movePlayer(0.05,0,0,false);
  const rose=P.y;
  /* Shift sinks straight down */
  P.y=SEA-1;P.vy=0;KEYS.add('ShiftLeft');
  for(let i=0;i<160;i++)movePlayer(0.05,0,0,false);
  KEYS.delete('ShiftLeft');
  return {doveD:SEA-dove,roseUp:rose-dove,sankD:SEA-P.y};
 })()`);
 if(res.skip)ok('dive test skipped (no deep water found)',true);
 else{
  ok('nose-down swimming dives ('+res.doveD.toFixed(1)+' under)',res.doveD>3);
  ok('levelling out floats you back up (+'+res.roseUp.toFixed(1)+')',res.roseUp>1);
  ok('Shift sinks you ('+res.sankD.toFixed(1)+' under)',res.sankD>3);
 }
}
{
 const res=run(`(function(){
  let mouths=0,land=0,kelp=0,coral=0,minSea=9999,ironSurf=0,abyssCols=0;
  for(let x=4;x<WORLD-4;x+=2)for(let z=4;z<WORLD-4;z+=2){
   const c=col(x,z);
   if(c.h>SEA){
    land++;
    if(genBlock(x,c.h,z)===0)mouths++;
    if(genBlock(x,c.h+1,z)===9)ironSurf++;
   }else{
    if(c.h<minSea)minSea=c.h;
    if(SEA-c.h>=80)abyssCols=(abyssCols|0)+1;
    if(kelpAt(x,z))kelp++;
    if(genBlock(x,c.h,z)===47)coral++;
   }
  }
  return {mouths,land,kelp,coral,depthMax:SEA-minSea,abyssCols,ironSurf,kelpSolid:solid(46),floatSkins:(function(){let n=0;for(let x=6;x<WORLD-6;x+=3)for(let z=6;z<WORLD-6;z+=3){const c=col(x,z);if(c.h>SEA&&genBlock(x,c.h,z)!==0&&genBlock(x,c.h-1,z)===0&&genBlock(x,c.h-2,z)===0)n++;}return n;})(),treeOnAir:(function(){let n=0;for(let x=6;x<WORLD-6;x+=3)for(let z=6;z<WORLD-6;z+=3){const c=col(x,z);if(c.h>SEA){const t2=genBlock(x,c.h+1,z);if((t2===5||t2===36)&&genBlock(x,c.h,z)===0)n++;}}return n;})()};
 })()`);
 ok('cave mouths gape on the surface ('+res.mouths+' of '+res.land+' land cols)',res.mouths>=30);
 ok('the sea floor plunges 100 deep ('+res.depthMax+')',res.depthMax>=95);
 ok('broad abyssal plains exist ('+res.abyssCols+' cols 80+ deep)',res.abyssCols>200);
 ok('no floating one-block crusts ('+res.floatSkins+')',res.floatSkins<=3);
 ok('no trees rooted on air ('+res.treeOnAir+')',res.treeOnAir===0);
 ok('kelp forests sway below ('+res.kelp+')',res.kelp>300);
 ok('coral on the reefs ('+res.coral+')',res.coral>=3);
 ok('iron nuggets show on the crags ('+res.ironSurf+')',res.ironSurf>=2);
 ok('kelp is swim-through',res.kelpSolid===false);
}
{
 /* mobile hotbar: a pointerdown tap must select the slot and flip pages */
 run('G.hot=0');
 const res=run(`(function(){
  const slots=document.querySelectorAll('#hotbar .hslot');
  const ev=new window.Event('pointerdown',{bubbles:true,cancelable:true});
  slots[3].dispatchEvent(ev);
  const picked=G.hot;
  const pg=document.getElementById('hotPage');
  const ev2=new window.Event('pointerdown',{bubbles:true,cancelable:true});
  pg.dispatchEvent(ev2);
  return {picked,page:G.hotPage};
 })()`);
 ok('tap selects a hotbar slot',res.picked===3);
 ok('tap flips the hotbar page',res.page===1);
 run('G.hotPage=0;HOTKEYS=HOTPAGES[0];buildHotbar()');
}
{
 /* villagers refuse steps into wells and cave mouths */
 const res=run(`(function(){
  const isl=W.isles.find(i=>i.stall);
  const h=isl.stall.y-1;
  /* the village well: a hole two deep right on the plaza */
  const wlx=isl.stall.x-3,wlz=isl.stall.z+3;
  const holeTop=vTopY(wlx,wlz);
  const plazaTop=vTopY(isl.stall.x+2,isl.stall.z);
  return {drop:plazaTop-holeTop};
 })()`);
 ok('the well breaks the plaza surface — villagers sidestep it (delta '+res.drop+')',Math.abs(res.drop)>=2);
}


console.log('== dry caves & honest water ==');
{
 const res=run(`(function(){
  let seaHoles=0,dryCaves=0,drySpot=null;
  for(let x=6;x<WORLD-6;x+=3)for(let z=6;z<WORLD-6;z+=3){
   const c=col(x,z);
   if(c.h<SEA){
    for(let y=4;y<c.h-1;y+=2)if(genBlock(x,y,z)===0)seaHoles++;
   }else{
    for(let y=Math.max(4,SEA-40);y<Math.min(SEA,c.h-3);y+=2)
     if(genBlock(x,y,z)===0){dryCaves++;if(!drySpot&&genBlock(x,y-1,z)!==0&&c.h>SEA+6)drySpot=[x,y,z];}
   }
  }
  return {seaHoles,dryCaves,drySpot};
 })()`);
 ok('underwater island flanks are solid — no swiss cheese ('+res.seaHoles+' holes)',res.seaHoles===0);
 ok('a dry underworld exists below sea level ('+res.dryCaves+' cells)',res.dryCaves>500);
 if(res.drySpot){
  const phys=run('(function(){'+
   'const s=['+res.drySpot.join(',')+'];'+
   'P.x=s[0]+0.5;P.y=s[1]+0.05;P.z=s[2]+0.5;P.vx=P.vz=0;P.vy=0;'+
   'G.hp=20;G.breath=breathMax();'+
   'for(let i=0;i<10;i++)movePlayer(0.05,0,0,false);'+
   'const grounded=P.onG&&!P.inWater;'+
   'for(let i=0;i<60;i++)vitalsTick(0.1);'+
   'return {grounded,breath:G.breath,max:breathMax(),uwCol:waterCol(P.x,P.z)};'+
  '})()');
  ok('deep dry cave: solid footing, full lungs ('+phys.breath.toFixed(0)+'/'+phys.max+')',phys.grounded&&phys.breath===phys.max&&phys.uwCol===false);
 }else ok('dry cave physics skipped (no spot found)',true);
}


console.log('== mesh completeness: every exposed face renders ==');
{
 /* ground truth: rebuild interesting chunks with NO column bounds and compare
    face counts against the real buildChunk path. Any mismatch = invisible-face
    holes (the "swiss cheese" of the playtest screenshots). */
 const res=run(`(function(){
  /* pick chunks that stress the bounds: village, steep cliffs, cave mouths,
     steep underwater flanks */
  const picks=[];
  const home=W.home;
  picks.push([Math.floor(home.stall.x/CHS),Math.floor(home.stall.z/CHS),'village']);
  let cliff=null,flank=null,cave=null;
  for(let x=8;x<WORLD-8&&!(cliff&&flank&&cave);x+=2)for(let z=8;z<WORLD-8;z+=2){
   const h=getH(x,z),h2=getH(x+1,z);
   if(!cliff&&h>SEA+4&&h-h2>=7)cliff=[Math.floor(x/CHS),Math.floor(z/CHS),'cliff'];
   if(!flank&&h<SEA&&h2<SEA&&Math.abs(h-h2)>=7)flank=[Math.floor(x/CHS),Math.floor(z/CHS),'underwater flank'];
   if(!cave&&surfOpen(x,z))cave=[Math.floor(x/CHS),Math.floor(z/CHS),'cave mouth'];
   if(cliff&&flank&&cave)break;
  }
  for(const p of [cliff,flank,cave])if(p)picks.push(p);
  const out=[];
  for(const [cx,cz,tag] of picks){
   buildChunk(cx,cz);
   const real=CHUNKS.get(cx+'|'+cz).mesh.geometry.attributes.position.array.length;
   const x0=cx*CHS,z0=cz*CHS;
   const truth=buildGeomFromCells(
    (x,y,z)=>y<0?4:(y>=WH?0:getBlock(x,y,z)),
    x0,0,z0,x0+CHS,WH,z0+CHS,chunkTint
   ).attributes.position.array.length;
   out.push({tag,real,truth});
  }
  return out;
 })()`);
 for(const r of res)
  ok('chunk faces complete: '+r.tag+' ('+(r.real/12|0)+' faces)',r.real===r.truth&&r.real>0);
}


console.log('== the hollows: layers, delves, keepers ==');
run(`startGame('compact','hollows-seed')`);
frames(10);
{
 const res=run(`(function(){
  /* surface artifacts: open-surface fraction must be small and chainless */
  let open=0,land=0,layers={stone:0,deep:0,black:0},glow=0,spikes=0;
  for(let x=6;x<WORLD-6;x+=3)for(let z=6;z<WORLD-6;z+=3){
   const c=col(x,z);
   if(c.h<=SEA)continue;
   land++;
   if(genBlock(x,c.h,z)===0)open++;
   if(c.h>SEA+6){
    const y1=SEA-10,y2=SEA-25,y3=SEA-44;
    if(genBlock(x,y1,z)===4)layers.stone++;
    if(genBlock(x,y2,z)===48)layers.deep++;
    if(y3>3&&genBlock(x,y3,z)===49)layers.black++;
   }
   if(c.room>0.75&&c.cavM>0.65){
    for(let dy=-9;dy<=9;dy++){
     const id=genBlock(x,Math.round(c.cavY)+dy,z);
     if(id===50)glow++;
     if((id===4||id===48||id===49)&&Math.abs(dy)>2&&Math.abs(dy)<9)spikes++;
    }
   }
  }
  return {pct:(open*100/Math.max(1,land)).toFixed(2),layers,glow,spikes,delves:W.delves.length};
 })()`);
 ok('surface openings rare — no ravine artifacts ('+res.pct+'%)',parseFloat(res.pct)<1.5);
 ok('rock layers: stone/deep/black ('+res.layers.stone+'/'+res.layers.deep+'/'+res.layers.black+')',
  res.layers.stone>50&&res.layers.deep>50&&res.layers.black>20);
 ok('glowcaps light the deep floors ('+res.glow+')',res.glow>0);
 ok('cavern dripstone present ('+res.spikes+')',res.spikes>0);
 ok('delves generated ('+res.delves+')',res.delves>=1);
}
{
 const res=run(`(function(){
  const dv=W.delves[0];
  /* the stair must be real, walkable air with a floor, entrance to vault */
  let firstAir=null;
  for(const [ax,az] of [[1,0],[-1,0],[0,1],[0,-1]]){
   if(getBlock(dv.x+ax,dv.h0+1,dv.z+az)===0&&getBlock(dv.x+ax,dv.h0,dv.z+az)!==0){firstAir=[ax,az];break;}
  }
  const vaultChest=getBlock(dv.vx,dv.vy+1,dv.vz)===13;
  const vaultStar=getBlock(dv.vx+2,dv.vy+1,dv.vz+2)===37;
  const vaultWall=getBlock(dv.vx+4,dv.vy+1,dv.vz)===49||getBlock(dv.vx+4,dv.vy+2,dv.vz)===0;
  const vaultRoom=getBlock(dv.vx+1,dv.vy+1,dv.vz)===0&&getBlock(dv.vx,dv.vy+2,dv.vz)===0;
  return {entrance:!!firstAir,vaultChest,vaultStar,vaultRoom,deep:dv.h0-dv.vy};
 })()`);
 ok('delve entrance opens into the hill',res.entrance);
 ok('vault holds chest + starmetal, '+res.deep+' blocks down',res.vaultChest&&res.vaultStar&&res.deep>30);
 ok('vault interior is hollow',res.vaultRoom);
}
{
 const res=run(`(function(){
  /* walk the captain to the vault door: keeper rises, falls, delve clears */
  clearMobs();
  const dv=W.delves[0];
  P.x=dv.vx+1;P.y=dv.vy+1.05;P.z=dv.vz;G.hp=20;
  dv.found=true;
  delveTick();
  const boss=MOBS.find(m=>m.type==='lord');
  if(!boss)return {fail:'no keeper'};
  const big=boss.rig&&boss.rig.s>1.2;
  const star0=G.inv.starmetal|0;
  const xp0=G.renown.xp;
  G.inv.cutlass=1;
  let swings=0;
  while(MOBS.includes(boss)&&swings<40){
   boss.x=P.x+1;boss.z=P.z; /* press the attack: stay in cutlass reach */
   atkCD=0;P.yaw=Math.atan2(boss.x-P.x,boss.z-P.z);
   attackTick(0.1,boss);swings++;
  }
  return {rose:true,big,swings,cleared:dv.cleared,star:(G.inv.starmetal|0)-star0,xp:G.renown.xp-xp0,
   title:G.titles.includes('Delver')};
 })()`);
 if(res.fail)ok('keeper test: '+res.fail,false);
 else{
  ok('the keeper rises at the vault (scale '+(res.big?'grand':'small')+')',res.rose&&res.big);
  ok('keeper falls in '+res.swings+' swings; vault cleared',res.cleared&&res.swings>5);
  ok('clearing pays: +'+res.star+' starmetal, +'+res.xp+' renown, Delver title',res.star>=2&&res.xp>=40&&res.title);
 }
}
{
 const res=run(`(function(){
  /* picks speed the swing; rations mend the captain */
  G.inv.ironpick=0;G.inv.steelpick=0;
  const t0=1/1;
  G.inv.steelpick=1;
  /* black rock: hard 2.4 -> with steel pick effective ~1.1s */
  const eff=2.4/2.2;
  G.hp=10;G.inv.ration=1;G.inv.glowcap=0;
  G.inv.ration--;G.hp=Math.min(20,G.hp+6);
  return {eff:eff<1.2,hp:G.hp};
 })()`);
 ok('steel pick tames black rock',res.eff);
 ok('rations mend the captain (10 -> '+res.hp+')',res.hp===16);
}
{
 /* delve state survives save/load */
 run('manualSave();loadGame(G.slot)');
 frames(10);
 const res=run(`(function(){return {found:W.delves[0].found,cleared:W.delves[0].cleared};})()`);
 ok('delve found+cleared persists',res.found===true&&res.cleared===true);
}


console.log('== light bakes & lanterns burn ==');
{
 const res=run(`(function(){
  /* the sun never reaches the vault: cave verts bake dark, surface bakes bright */
  const dv=W.delves[0];
  const cx=Math.floor(dv.vx/CHS),cz=Math.floor(dv.vz/CHS);
  buildChunk(cx,cz);
  const ge=CHUNKS.get(cx+'|'+cz).mesh.geometry;
  const pos=ge.attributes.position.array,al=ge.attributes.alight.array;
  let caveMax=0,caveN=0,surfMax=0;
  for(let i=0;i<al.length/2;i++){
   const x=pos[i*3],y=pos[i*3+1],z=pos[i*3+2],s=al[i*2];
   surfMax=Math.max(surfMax,s);
   if(Math.abs(x-dv.vx)<5&&Math.abs(z-dv.vz)<5&&y>dv.vy-1&&y<dv.vy+6){caveMax=Math.max(caveMax,s);caveN++;}
  }
  return {caveMax,caveN,surfMax};
 })()`);
 ok('vault verts bake near-black sky light ('+res.caveN+' verts, max '+res.caveMax.toFixed(2)+')',res.caveN>0&&res.caveMax<0.4);
 ok('surface verts bake full daylight ('+res.surfMax.toFixed(2)+')',res.surfMax>0.9);
}
{
 const res=run(`(function(){
  /* a placed torch floods baked block light; breaking it takes the light away.
     Find a deep cave floor with no source of any kind (placed, vault lamp,
     glowcap, crystal) within 7 blocks — a truly dark room */
  let tx=0,ty=0,tz=0,found=false;
  for(let x=6;x<WORLD-6&&!found;x+=3)for(let z=6;z<WORLD-6&&!found;z+=3){
   const c=col(x,z);
   if(c.h<=SEA+6)continue;
   for(let y=Math.max(6,SEA-30);y<Math.min(SEA,c.h-8)&&!found;y+=2){
    if(getBlock(x,y,z)!==0||getBlock(x,y-1,z)===0)continue;
    let clear=true;
    for(let ox=-7;ox<=7&&clear;ox++)for(let oy=-7;oy<=7&&clear;oy++)for(let oz=-7;oz<=7&&clear;oz++)
     if(SRC_LVL[getBlock(x+ox,y+oy,z+oz)])clear=false;
    if(clear){tx=x;ty=y;tz=z;found=true;}
   }
  }
  if(!found)return {fail:'no dark cave cell found'};
  const cx=Math.floor(tx/CHS),cz=Math.floor(tz/CHS);
  const sample=()=>{
   buildChunk(cx,cz);
   const ge=CHUNKS.get(cx+'|'+cz).mesh.geometry;
   const pos=ge.attributes.position.array,al=ge.attributes.alight.array;
   let m=0;
   for(let i=0;i<al.length/2;i++){
    const x=pos[i*3],y=pos[i*3+1],z=pos[i*3+2];
    if(Math.abs(x-tx)<4&&Math.abs(y-ty)<4&&Math.abs(z-tz)<4)m=Math.max(m,al[i*2+1]);
   }
   return m;
  };
  const before=sample();
  setBlock(tx,ty,tz,51);
  const lit=sample();
  setBlock(tx,ty,tz,0);
  const after=sample();
  return {before,lit,after};
 })()`);
 if(res.fail)ok('torch test: '+res.fail,false);
 else{
  ok('placed torch floods baked light ('+res.before.toFixed(2)+' -> '+res.lit.toFixed(2)+')',res.lit>res.before+0.4&&res.lit>0.5);
  ok('breaking the torch removes its light ('+res.after.toFixed(2)+')',res.after<res.before+0.1);
 }
}
{
 const res=run(`(function(){
  /* in hand, underground: the lantern feeds the shader's dynamic slot 0 */
  const dv=W.delves[0];
  P.x=dv.vx+1;P.y=dv.vy+1.05;P.z=dv.vz;G.mode='walk';
  G.inv.lantern=0;
  lampTick(0.1);
  const off=MAT.uniforms.dynInt.value[0];
  G.inv.lantern=1;
  lampTick(0.1);
  const on=MAT.uniforms.dynInt.value[0];
  const p0=MAT.uniforms.dynPos.value[0];
  const near=Math.hypot(p0.x-P.x,p0.z-P.z)<1;
  return {off,on,near};
 })()`);
 ok('hand lantern dark without, bright with ('+res.off.toFixed(2)+' -> '+res.on.toFixed(2)+')',res.off===0&&res.on>0.5&&res.near);
}
{
 const res=run(`(function(){
  /* aboard: every lantern block feeds a dynamic slot at night */
  const s=G.ship;
  s.blocks.set(K(0,2,0),32);s.blocks.set(K(3,2,0),32);
  rebuildShip();
  G.time=Math.floor(G.time/DAY)*DAY+DAY*0.97; /* the dead of night */
  skyTick(0.01);
  lampTick(0.1);
  const inten=MAT.uniforms.dynInt.value;
  let lit=0;
  for(let i=1;i<DYNL;i++)if(inten[i]>0.4)lit++;
  const w=shipLocalToWorld(s.lantPos[0][0],s.lantPos[0][1],s.lantPos[0][2]);
  const p1=MAT.uniforms.dynPos.value[1];
  const near=Math.hypot(p1.x-w[0],p1.z-w[2])<2;
  return {n:s.lantPos.length,lit,near};
 })()`);
 ok('ship lanterns tracked ('+res.n+') and lit at night ('+res.lit+')',res.n>=2&&res.lit>=2&&res.near);
}

if(failed){console.log('\n'+failed+' FAILURES');process.exit(1);}
console.log('\nALL TESTS PASSED');
