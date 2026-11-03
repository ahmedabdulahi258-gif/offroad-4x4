import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ---------- terrain ----------
const N = 128, SIZE = 600, EL = SIZE / (N - 1);
function rnd(s){return ()=> (s=(s*16807)%2147483647)/2147483647;}
const R = rnd(42);
function hRaw(x, z){
  let h = 8*Math.sin(x*0.012)*Math.cos(z*0.015) + 5*Math.sin(x*0.031+1)*Math.sin(z*0.027) + 1.2*Math.sin(x*0.11)*Math.cos(z*0.13);
  h += 14*Math.exp(-((x-150)**2+(z+120)**2)/4000); // big hill
  h += 18*Math.exp(-((x+170)**2+(z-160)**2)/3000); // steep hill
  h += 3.2*Math.pow(Math.sin(x*0.045+z*0.018),2) + 1.6*Math.sin(x*0.02-z*0.05)*Math.sin(z*0.033); // dunes
  h += 0.7*Math.sin(x*0.26+z*0.07)*Math.sin(z*0.22-x*0.05); // whoops / rough bumps
  const d = Math.hypot(x, z); if (d < 40) h *= d/40; // flat spawn
  // ramps
  for (const [rx, rz] of [[60,0],[-40,80],[0,-90]]) { const u=(x-rx), v=Math.abs(z-rz); if (v<6 && u>-14 && u<0) h += (u+14)*0.35; }
  return h;
}
const MUD = {x:-60,z:-40,r:35};
const data = [];
for (let i=0;i<N;i++){ const row=[]; for(let j=0;j<N;j++){ const x=-SIZE/2+i*EL, z=SIZE/2-j*EL; row.push(hRaw(x,z)); } data.push(row); }
function heightAt(x,z){ const i=(x+SIZE/2)/EL, j=(SIZE/2-z)/EL; const i0=Math.max(0,Math.min(N-2,Math.floor(i))), j0=Math.max(0,Math.min(N-2,Math.floor(j))); const fi=i-i0,fj=j-j0;
  return (data[i0][j0]*(1-fi)+data[i0+1][j0]*fi)*(1-fj)+(data[i0][j0+1]*(1-fi)+data[i0+1][j0+1]*fi)*fj; }

const renderer = new THREE.WebGLRenderer({antialias: devicePixelRatio < 2});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf0d6a8); scene.fog = new THREE.Fog(0xf0d6a8, 110, 360);
const camera = new THREE.PerspectiveCamera(65, innerWidth/innerHeight, 0.5, 800);
scene.add(new THREE.HemisphereLight(0xfff0d8, 0x8a6a3a, 0.85));
const sun = new THREE.DirectionalLight(0xffe2b0, 1.7); sun.position.set(50,100,30); sun.castShadow = true;
sun.shadow.mapSize.set(1024,1024); Object.assign(sun.shadow.camera,{left:-50,right:50,top:50,bottom:-50,far:250}); scene.add(sun, sun.target);

const tg = new THREE.PlaneGeometry(SIZE, SIZE, N-1, N-1); tg.rotateX(-Math.PI/2);
const pos = tg.attributes.position, cols = [];
for (let k=0;k<pos.count;k++){ const x=pos.getX(k), z=pos.getZ(k), h=heightAt(x,z); pos.setY(k,h);
  const mud = Math.hypot(x-MUD.x,z-MUD.z) < MUD.r; const c = mud ? new THREE.Color().setHSL(0.08, 0.38, 0.3+R()*0.03) : new THREE.Color().setHSL(0.105+R()*0.01, 0.5, 0.58+h*0.004+0.04*Math.sin(x*0.9+z*0.3)+R()*0.04); cols.push(c.r,c.g,c.b); }
tg.setAttribute('color', new THREE.Float32BufferAttribute(cols,3)); tg.computeVertexNormals();
const terrain = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({vertexColors:true})); terrain.receiveShadow = true; scene.add(terrain);
// puddle
const water = new THREE.Mesh(new THREE.CircleGeometry(14, 24), new THREE.MeshLambertMaterial({color:0x5a6f6a, transparent:true, opacity:0.7}));
water.rotation.x=-Math.PI/2; water.position.set(MUD.x+10, heightAt(MUD.x+10,MUD.z)+0.25, MUD.z); scene.add(water);

const world = new CANNON.World({gravity: new CANNON.Vec3(0,-9.82,0)}); world.broadphase = new CANNON.SAPBroadphase(world); world.allowSleep = false;
const groundMat = new CANNON.Material('g');
const hf = new CANNON.Heightfield(data, {elementSize: EL});
const hb = new CANNON.Body({mass:0, material:groundMat}); hb.addShape(hf);
hb.position.set(-SIZE/2, 0, SIZE/2); hb.quaternion.setFromEuler(-Math.PI/2, 0, 0); world.addBody(hb);

// obstacles: rocks and trees
const rockMat = new THREE.MeshLambertMaterial({color:0x8a7258, flatShading:true});
const trunkMat = new THREE.MeshLambertMaterial({color:0x6b5a38}), leafMat = new THREE.MeshLambertMaterial({color:0x9a8550, flatShading:true});
const rockGeo = new THREE.DodecahedronGeometry(1,0), leafGeo = new THREE.IcosahedronGeometry(1.4,0), trunkGeo = new THREE.CylinderGeometry(0.35,0.4,3.2,6);
for (let n=0;n<160;n++){ const x=(R()-0.5)*SIZE*0.9, z=(R()-0.5)*SIZE*0.9; if (Math.hypot(x,z)<35) continue; const y=heightAt(x,z);
  if (R()<0.5){ const s=0.6+R()*1.6; const m=new THREE.Mesh(rockGeo,rockMat); m.scale.setScalar(s); m.position.set(x,y+s*0.3,z); m.rotation.set(R()*3,R()*3,0); m.castShadow=true; scene.add(m);
    const b=new CANNON.Body({mass:0}); b.addShape(new CANNON.Sphere(s*0.9)); b.position.set(x,y+s*0.3,z); world.addBody(b); }
  else { const g=new THREE.Group(); const t=new THREE.Mesh(trunkGeo,trunkMat); t.position.y=1.6; const l=new THREE.Mesh(leafGeo,leafMat); l.position.set(1.2,0.7,0); l.scale.set(1,0.6,1); l.castShadow=true; g.add(t,l); g.position.set(x,y,z); scene.add(g);
    const b=new CANNON.Body({mass:0}); b.addShape(new CANNON.Cylinder(0.5,0.5,3.2,6)); b.position.set(x,y+1.6,z); world.addBody(b); } }

// ---------- truck ----------
const chassis = new CANNON.Body({mass: 1900}); chassis.addShape(new CANNON.Box(new CANNON.Vec3(1.1,0.5,2.3)), new CANNON.Vec3(0,0.2,0));
chassis.angularDamping = 0.12; chassis.linearDamping = 0.02; world.addBody(chassis);
const vehicle = new CANNON.RaycastVehicle({chassisBody: chassis, indexRightAxis:0, indexUpAxis:1, indexForwardAxis:2});
const wOpt = {radius:0.55, directionLocal:new CANNON.Vec3(0,-1,0), suspensionStiffness:17, suspensionRestLength:0.65, frictionSlip:2, dampingRelaxation:1.6, dampingCompression:2.6,
  maxSuspensionForce:1e5, rollInfluence:0.35, axleLocal:new CANNON.Vec3(-1,0,0), maxSuspensionTravel:0.7, customSlidingRotationalSpeed:-30, useCustomSlidingRotationalSpeed:true};
// 0 FL,1 FR,2 RL,3 RR (forward = +z)
for (const [x,z] of [[1.15,1.5],[-1.15,1.5],[1.15,-1.5],[-1.15,-1.5]]) vehicle.addWheel({...wOpt, chassisConnectionPointLocal:new CANNON.Vec3(x,-0.1,z)});
vehicle.addToWorld(world);

const truck = new THREE.Group(); scene.add(truck);
const paint = new THREE.MeshLambertMaterial({color:0xd8401f}), dark=new THREE.MeshLambertMaterial({color:0x222222}), glass=new THREE.MeshLambertMaterial({color:0x223344});
const box=(w,h,d,m,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;truck.add(o);return o;};
box(2.2,0.7,4.6,paint,0,0.2,0); box(2.0,0.8,1.9,paint,0,0.95,0.1); box(2.02,0.55,1.6,glass,0,1.0,0.12);
box(2.3,0.25,0.3,dark,0,0,2.35); box(2.3,0.25,0.3,dark,0,0,-2.35); box(1.8,0.15,0.15,dark,0,1.45,0.1);
for (const x of [-0.6,0.6]) { const l=box(0.3,0.2,0.05,new THREE.MeshBasicMaterial({color:0xffffcc}),x,0.35,2.31); }
const wheelGeo = new THREE.CylinderGeometry(0.55,0.55,0.45,16); wheelGeo.rotateZ(Math.PI/2);
const tireMat = new THREE.MeshLambertMaterial({color:0x1a1a1a}), hubMat=new THREE.MeshLambertMaterial({color:0xbbbbbb});
const wheels = vehicle.wheelInfos.map(()=>{ const g=new THREE.Group(); const t=new THREE.Mesh(wheelGeo,tireMat); t.castShadow=true; const h=new THREE.Mesh(new THREE.BoxGeometry(0.47,0.5,0.12),hubMat); g.add(t,h); scene.add(g); return g; });
const struts = vehicle.wheelInfos.map(()=>{ const s=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,1,6),new THREE.MeshLambertMaterial({color:0xffd23f})); scene.add(s); return s; });

// ---------- checkpoints ----------
const CPS = [[80,30],[150,-120],[-60,-40],[-170,160],[20,200]].map(([x,z],i)=>{
  const m=new THREE.Mesh(new THREE.TorusGeometry(6,0.5,8,24), new THREE.MeshBasicMaterial({color:0x00ffaa, transparent:true, opacity:0.8}));
  const y=heightAt(x,z)+6; m.position.set(x,y,z); scene.add(m);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.6,80,8,1,true),new THREE.MeshBasicMaterial({color:0x00ffaa,transparent:true,opacity:0.25})); beam.position.set(x,y+40,z); scene.add(beam);
  return {m,beam,x,z,done:false}; });

// ---------- state & input ----------
const keys = {}; let awd = true, low = false, playing = false, t0 = 0, nextCp = 0, finished = false, best = +localStorage.getItem('offroad4x4_best') || 0;
const $ = id => document.getElementById(id);
$('best').textContent = 'Best: ' + (best ? best.toFixed(2)+'s' : '--');
const map = {KeyW:'gas',ArrowUp:'gas',KeyS:'brake',ArrowDown:'brake',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'hb'};
addEventListener('keydown', e => { if (map[e.code]) { keys[map[e.code]] = true; e.preventDefault(); }
  if (e.repeat) return; if (e.code==='KeyF') act('awd'); if (e.code==='KeyG') act('low'); if (e.code==='KeyR') act('reset'); });
addEventListener('keyup', e => { if (map[e.code]) keys[map[e.code]] = false; });
function act(a){ if (a==='awd') { awd=!awd; flash(awd?'4WD ENGAGED':'2WD (RWD)'); } if (a==='low') { low=!low; flash(low?'LOW GEAR':'HIGH GEAR'); } if (a==='reset') reset(false); updMode(); }
function updMode(){ $('mode').textContent=(awd?'4WD':'2WD')+(low?' · LOW':''); document.querySelector('[data-a=awd]').classList.toggle('on',awd); document.querySelector('[data-a=low]').classList.toggle('on',low); }
let msgT; function flash(s){ $('msg').textContent=s; clearTimeout(msgT); msgT=setTimeout(()=>$('msg').textContent='',1200); }
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.body.classList.add('touch');
document.querySelectorAll('#touch button').forEach(b => {
  const k=b.dataset.k, a=b.dataset.a;
  b.addEventListener('touchstart', e => { e.preventDefault(); if (k){keys[k]=true;b.classList.add('on');} if (a) act(a); }, {passive:false});
  const up = e => { e.preventDefault(); if (k){keys[k]=false;b.classList.remove('on');} };
  b.addEventListener('touchend', up, {passive:false}); b.addEventListener('touchcancel', up, {passive:false});
});
document.addEventListener('touchmove', e => e.preventDefault(), {passive:false});
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

function reset(full){
  let x=0,z=0,yaw=0;
  if (!full) { x=chassis.position.x; z=chassis.position.z; const f=new CANNON.Vec3(); chassis.quaternion.vmult(new CANNON.Vec3(0,0,1),f); yaw=Math.atan2(f.x,f.z); }
  chassis.position.set(x, heightAt(x,z)+2.5, z); chassis.quaternion.setFromEuler(0,yaw,0);
  chassis.velocity.setZero(); chassis.angularVelocity.setZero();
}
function startRun(){ playing=true; finished=false; nextCp=0; t0=performance.now(); CPS.forEach((c,i)=>{c.done=false; c.m.material.color.set(i===0?0xffee00:0x00ffaa);}); reset(true); $('start').style.display='none'; }
$('play').addEventListener('click', startRun); $('play').addEventListener('touchend', e=>{e.preventDefault(); startRun();});
updMode(); reset(true);

// ---------- loop ----------
let thr = 0, dI = 0; const DN = 120, dPos = new Float32Array(DN*3).fill(-999), dVel = new Float32Array(DN*3), dLife = new Float32Array(DN);
const dGeo = new THREE.BufferGeometry(); dGeo.setAttribute('position', new THREE.BufferAttribute(dPos,3));
const dust = new THREE.Points(dGeo, new THREE.PointsMaterial({color:0xd9bf8c, size:0.9, transparent:true, opacity:0.55, depthWrite:false})); dust.frustumCulled=false; scene.add(dust);
let steer = 0, last = performance.now(); const camPos = new THREE.Vector3(0,10,-15), tmp = new THREE.Vector3(), look = new THREE.Vector3();
function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now-last)/1000); last = now;
  const fwdV = new CANNON.Vec3(); chassis.quaternion.vmult(new CANNON.Vec3(0,0,1), fwdV);
  const speed = chassis.velocity.dot(fwdV); // m/s
  const inMud = Math.hypot(chassis.position.x-MUD.x, chassis.position.z-MUD.z) < MUD.r;
  // steering
  const target = playing ? ((keys.left?1:0)-(keys.right?1:0)) * (0.5 - Math.min(0.36, Math.abs(speed)*0.018)) : 0;
  steer += (target-steer)*Math.min(1, dt*3); vehicle.setSteeringValue(steer,0); vehicle.setSteeringValue(steer,1);
  // drive
  const maxF = low ? 7600 : 3000, top = low ? 8 : 26;
  let throttle = 0, brake = 0;
  if (playing) { if (keys.gas) throttle = speed < top ? 1 : 0; if (keys.brake) { if (speed > 1) brake = 1; else throttle = speed > -(low?5:10) ? -0.7 : 0; } }
  thr += (throttle-thr)*Math.min(1, dt*(Math.abs(throttle)>Math.abs(thr)?1.2:4)); // slow torque build-up
  const upV = new CANNON.Vec3(); chassis.quaternion.vmult(new CANNON.Vec3(0,1,0), upV);
  const grade = Math.max(0, fwdV.y*Math.sign(thr||1)); // climbing steepness
  const climb = awd ? 1 : Math.max(0.15, 1-grade*2.6); // 2WD struggles on slopes
  let F = -thr*maxF*(inMud?0.5:1)*climb;
  const fr = awd ? 0.5 : 0; // torque split front/rear
  vehicle.applyEngineForce(F*fr,0); vehicle.applyEngineForce(F*fr,1); vehicle.applyEngineForce(F*(1-fr),2); vehicle.applyEngineForce(F*(1-fr),3);
  // traction: 4WD grips more; 2WD loses grip on slopes/mud
  vehicle.wheelInfos.forEach((w,i)=>{ let fs = awd ? 2.1 : (i<2 ? 1.6 : 1.15); if (inMud) fs *= 0.5; if (keys.hb && i>=2) fs *= 0.35; w.frictionSlip = fs; });
  for (let i=0;i<4;i++) vehicle.setBrake(brake*60, i);
  if (keys.hb && playing) { vehicle.setBrake(90,2); vehicle.setBrake(90,3); }
  if (!throttle && !brake) for (let i=0;i<4;i++) vehicle.setBrake(low?12:3, i); // engine braking (low gear holds on hills)
  const onGround = vehicle.wheelInfos.some(w=>w.isInContact);
  if (onGround) { const k = inMud ? 0.9 : 0.12+Math.abs(speed)*0.004; chassis.velocity.x*=1-dt*k; chassis.velocity.z*=1-dt*k; } // sand drag
  // dust
  if (onGround && Math.abs(speed)>3 && dI%2===0) for (const i of [2,3]) { const w=vehicle.wheelInfos[i]; if(!w.isInContact) continue; const p=w.raycastResult.hitPointWorld; const k=dI++%DN*3; dPos[k]=p.x+(Math.random()-.5); dPos[k+1]=p.y+0.3; dPos[k+2]=p.z+(Math.random()-.5); dVel[k]=(Math.random()-.5)*2; dVel[k+1]=1+Math.random()*2; dVel[k+2]=(Math.random()-.5)*2; dLife[k/3]=1; } else dI++;
  for (let n=0;n<DN;n++){ if(dLife[n]<=0) continue; dLife[n]-=dt*0.9; const k=n*3; dPos[k]+=dVel[k]*dt; dPos[k+1]+=dVel[k+1]*dt; dPos[k+2]+=dVel[k+2]*dt; if(dLife[n]<=0) dPos[k+1]=-999; }
  dGeo.attributes.position.needsUpdate=true;
  world.step(1/60, dt, 3);
  if (chassis.position.y < -50) reset(true);

  // sync visuals
  truck.position.copy(chassis.position); truck.quaternion.copy(chassis.quaternion);
  vehicle.wheelInfos.forEach((w,i)=>{ vehicle.updateWheelTransform(i); const t=w.worldTransform; wheels[i].position.copy(t.position); wheels[i].quaternion.copy(t.quaternion);
    const top = new THREE.Vector3(w.chassisConnectionPointWorld.x, w.chassisConnectionPointWorld.y, w.chassisConnectionPointWorld.z);
    const mid = top.clone().add(wheels[i].position).multiplyScalar(0.5); struts[i].position.copy(mid); struts[i].scale.y = Math.max(0.05, top.distanceTo(wheels[i].position));
    struts[i].quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), top.sub(wheels[i].position).normalize()); });

  // camera
  const f3 = new THREE.Vector3(fwdV.x, 0, fwdV.z).normalize();
  tmp.copy(truck.position).addScaledVector(f3, -11).add(new THREE.Vector3(0,5,0));
  tmp.y = Math.max(tmp.y, heightAt(tmp.x,tmp.z)+2);
  camPos.lerp(tmp, 1-Math.exp(-dt*4)); camera.position.copy(camPos);
  look.lerp(tmp.copy(truck.position).add(new THREE.Vector3(0,1.5,0)), 1-Math.exp(-dt*10)); camera.lookAt(look);
  sun.position.copy(truck.position).add(new THREE.Vector3(40,80,25)); sun.target.position.copy(truck.position);

  // checkpoints
  CPS.forEach((c,i)=>{ c.m.rotation.y += dt; c.beam.visible = !c.done; c.m.visible = !c.done; });
  if (playing && !finished) {
    const c = CPS[nextCp];
    if (Math.hypot(chassis.position.x-c.x, chassis.position.z-c.z) < 8) { c.done=true; nextCp++;
      if (nextCp >= CPS.length) { finished = true; const t=(now-t0)/1000; if (!best || t<best) { best=t; localStorage.setItem('offroad4x4_best', t); flash('NEW BEST! '+t.toFixed(2)+'s'); } else flash('FINISH '+t.toFixed(2)+'s');
        $('best').textContent='Best: '+best.toFixed(2)+'s'; setTimeout(()=>{ $('start').style.display='flex'; $('play').textContent='PLAY AGAIN'; playing=false; }, 2000); }
      else { flash('CHECKPOINT '+nextCp); CPS[nextCp].m.material.color.set(0xffee00); } }
    $('time').textContent = ((now-t0)/1000).toFixed(2)+'s';
  }
  $('cp').textContent = `CP ${nextCp}/${CPS.length}`;
  $('speed').innerHTML = Math.round(Math.abs(speed)*2.237) + ' <small>mph</small>' + (inMud?' <small>DEEP SAND</small>':'');
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
addEventListener('resize', () => { camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
