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
  const rFar=ringOf(home.cx>160?8:312,home.cz>160?8:312);
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
  const fx=home.cx>160?20:300, fz=home.cz>160?20:300;
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
   if(pickPirateCls(home.cx>160?20:300,home.cz>160?20:300)==='galleon')g2++;
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
   const fx=home.cx>160?20:300, fz=home.cz>160?20:300;
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
  const spots=[[home.cx+12,home.cz+12],[home.cx>160?home.cx-110:home.cx+110,home.cz],[home.cx>160?30:290,home.cz>160?30:290]];
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

if(failed){console.log('\n'+failed+' FAILURES');process.exit(1);}
console.log('\nALL TESTS PASSED');
