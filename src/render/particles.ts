export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  r: number;
  hue: string;
}

export function updateAndDrawParticles(
  particles: Particle[],
  ctx: CanvasRenderingContext2D,
  dt: number
): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vy += 0.0006 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt * 0.0016;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.hue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
