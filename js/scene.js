// ==================== THREE.JS SCENE MANAGER ====================
// Handles 3D rendering of the game world using Three.js

import { CONFIG } from './config.js';

// THREE is loaded globally via script tag
const THREE = window.THREE;

class SceneManager {
constructor(canvas) {
this.canvas = canvas; this.scene = new THREE.Scene(); this.clock = new THREE.Clock();
this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.setClearColor(0x1a3a4a);
this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 1, 1000); this.camera.position.set(0, 80, 100);
this.scene.add(new THREE.AmbientLight(0xffeedd, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(50, 100, 50); this.scene.add(sun);
this.createOcean(); this.createIslands();
this.ship = this.createShip(); this.scene.add(this.ship); this.shipHeading = 0;
addEventListener('resize', () => this.onResize()); this.onResize();
}
createOcean() {
const geo = new THREE.PlaneGeometry(2000, 2000, 50, 50); this.oceanPos = geo.getAttribute('position').array.slice();
this.ocean = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color: 0x2d5a6a, shininess: 100, side: THREE.DoubleSide }));
this.ocean.rotation.x = -Math.PI / 2; this.ocean.position.y = -2; this.scene.add(this.ocean);
}
createIslands() {
const colors = { english: 0xc41e3a, eitc: 0x1e4d2b, pirates: 0x2c2c2c, neutral: 0x808080 };
Object.entries(CONFIG.islands).forEach(([id, cfg]) => {
const g = new THREE.Group(); g.position.set(cfg.position.x, 0, cfg.position.z);
const r = 15 + Math.random() * 5;
g.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.2, 8, 8), new THREE.MeshLambertMaterial({ color: cfg.color }))); g.children[0].position.y = 2;
const beach = new THREE.Mesh(new THREE.TorusGeometry(r * 1.1, 2, 8, 16), new THREE.MeshLambertMaterial({ color: 0xf4e4c1 })); beach.rotation.x = Math.PI / 2; beach.position.y = -0.5; g.add(beach);
for (let i = 0; i < 4; i++) { const tree = new THREE.Group(), a = i * 1.5 + Math.random(), d = 6 + Math.random() * 4; tree.position.set(Math.cos(a) * d, 6, Math.sin(a) * d); tree.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 3, 6), new THREE.MeshLambertMaterial({ color: 0x8b4513 }))); const lv = new THREE.Mesh(new THREE.ConeGeometry(3, 6, 6), new THREE.MeshLambertMaterial({ color: 0x228b22 })); lv.position.y = 5; tree.add(lv); g.add(tree); }
const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 12, 6), new THREE.MeshLambertMaterial({ color: 0x8b4513 })); pole.position.y = 12; g.add(pole);
const flag = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.5), new THREE.MeshLambertMaterial({ color: colors[cfg.faction], side: THREE.DoubleSide })); flag.position.set(2.5, 16, 0); g.add(flag);
this.scene.add(g);
});
}
createShip() {
const s = new THREE.Group();
s.add(new THREE.Mesh(new THREE.BoxGeometry(4, 2, 10), new THREE.MeshLambertMaterial({ color: 0x8b4513 }))); s.children[0].position.y = 1;
s.add(new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.5, 9), new THREE.MeshLambertMaterial({ color: 0xdeb887 }))); s.children[1].position.y = 2.5;
s.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 12, 8), new THREE.MeshLambertMaterial({ color: 0x4a3728 }))); s.children[2].position.y = 8;
const sail = new THREE.Mesh(new THREE.PlaneGeometry(6, 8), new THREE.MeshLambertMaterial({ color: 0xf5f0e1, side: THREE.DoubleSide })); sail.position.set(0, 9, 1); sail.rotation.y = Math.PI / 2; s.add(sail);
const bow = new THREE.Mesh(new THREE.ConeGeometry(1, 3, 6), new THREE.MeshLambertMaterial({ color: 0xc9a227 })); bow.position.set(0, 1, 6); bow.rotation.x = Math.PI / 2; s.add(bow);
return s;
}
updateShip(pos, heading) {
this.ship.position.set(pos.x, Math.sin(this.clock.getElapsedTime() * 2) * 0.5, pos.z);
this.ship.rotation.z = Math.sin(this.clock.getElapsedTime() * 1.5) * 0.05;
if (heading !== null) this.shipHeading += (heading - this.shipHeading) * 0.1;
this.ship.rotation.y = this.shipHeading;
}
updateCamera(sp) { this.camera.position.x += (sp.x - this.camera.position.x) * 0.05; this.camera.position.z += (sp.z + 80 - this.camera.position.z) * 0.05; this.camera.lookAt(sp.x, 0, sp.z); }
onResize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth, innerHeight); }
render() {
const t = this.clock.getElapsedTime(), pos = this.ocean.geometry.getAttribute('position').array;
for (let i = 0; i < pos.length; i += 3) pos[i + 2] = Math.sin(this.oceanPos[i] * 0.02 + t) * 1.5 + Math.sin(this.oceanPos[i + 1] * 0.03 + t * 0.8);
this.ocean.geometry.getAttribute('position').needsUpdate = true;
this.renderer.render(this.scene, this.camera);
}
}

export { SceneManager };
