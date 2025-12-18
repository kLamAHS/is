// ==================== JOYSTICK CONTROLLER ====================
// Handles touch/mouse input for ship navigation

class Joystick {
constructor() {
this.base = document.getElementById('joystick-base'); this.stick = document.getElementById('joystick-stick'); this.zone = document.getElementById('joystick-zone');
this.active = false; this.value = { x: 0, y: 0 }; this.magnitude = 0; this.angle = 0; this.maxDist = 35;
this.zone.addEventListener('touchstart', e => this.start(e.touches[0]), { passive: false });
document.addEventListener('touchmove', e => { if (this.active) { e.preventDefault(); this.move(e.touches[0]); } }, { passive: false });
document.addEventListener('touchend', () => this.end()); document.addEventListener('touchcancel', () => this.end());
this.zone.addEventListener('mousedown', e => this.start(e)); document.addEventListener('mousemove', e => { if (this.active) this.move(e); }); document.addEventListener('mouseup', () => this.end());
}
start(e) { this.active = true; this.stick.classList.add('active'); this.rect = this.base.getBoundingClientRect(); this.move(e); }
move(e) {
if (!this.active || !this.rect) return;
let dx = e.clientX - (this.rect.left + this.rect.width / 2), dy = e.clientY - (this.rect.top + this.rect.height / 2);
const dist = Math.sqrt(dx * dx + dy * dy), cd = Math.min(dist, this.maxDist);
if (dist > 0) { dx = dx / dist * cd; dy = dy / dist * cd; }
this.stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
this.value = { x: dx / this.maxDist, y: dy / this.maxDist }; this.magnitude = cd / this.maxDist; this.angle = Math.atan2(-dx, -dy);
}
end() { this.active = false; this.stick.classList.remove('active'); this.stick.style.transform = 'translate(-50%, -50%)'; this.value = { x: 0, y: 0 }; this.magnitude = 0; }
}

export { Joystick };
