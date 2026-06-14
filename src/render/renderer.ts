import { Terrain } from '../engine/terrain';
import { ActiveProjectile } from '../weapons/types';
import { Particle, updateAndDrawParticles } from './particles';
import { Tank } from '../weapons/behaviors';

export class Renderer {
  private skyGrad: CanvasGradient | null = null;
  private skyKey = '';
  public shake = 0;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private getW: () => number,
    private getH: () => number
  ) {}

  applyShake(): void {
    if (this.shake > 0) {
      const s = this.shake;
      this.ctx.translate((Math.random() * 2 - 1) * s, (Math.random() * 2 - 1) * s);
      this.shake *= 0.88;
      if (this.shake < 0.4) this.shake = 0;
    }
  }

  drawSky(): void {
    const W = this.getW(), H = this.getH();
    const key = W + 'x' + H;
    if (key !== this.skyKey) {
      this.skyKey = key;
      this.skyGrad = this.ctx.createLinearGradient(0, 0, 0, H);
      this.skyGrad.addColorStop(0, '#1b1430');
      this.skyGrad.addColorStop(0.55, '#5a3b6e');
      this.skyGrad.addColorStop(1, '#c9683f');
    }
    this.ctx.fillStyle = this.skyGrad!;
    this.ctx.fillRect(0, 0, W, H);
    this.ctx.save();
    const g = this.ctx.createRadialGradient(W * 0.5, H * 0.66, 0, W * 0.5, H * 0.66, W * 0.5);
    g.addColorStop(0, 'rgba(255,210,140,.5)');
    g.addColorStop(1, 'rgba(255,210,140,0)');
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, W, H);
    this.ctx.restore();
  }

  drawTank(
    t: Tank,
    active: boolean,
    phase: string,
    angleRad: number
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.color;
    this.roundRect(-15, -12, 30, 12, 4);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -12, 8, Math.PI, 0);
    ctx.fill();
    const ang = active && phase === 'aim' ? angleRad : (t.dir > 0 ? 50 : 130) * Math.PI / 180;
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(Math.cos(ang) * 22, -13 - Math.sin(ang) * 22);
    ctx.stroke();
    if (active && phase === 'aim') {
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(0, -6, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  drawAimArc(
    tank: Tank,
    angleDeg: number,
    power: number,
    wind: number,
    terrain: Terrain
  ): void {
    const GRAV = 0.0011;
    const rad = angleDeg * Math.PI / 180;
    const v = power * 0.62 * 0.06;
    let x = tank.x + Math.cos(rad) * 22;
    let y = tank.y - 14 - Math.sin(rad) * 22;
    let vx = Math.cos(rad) * v;
    let vy = -Math.sin(rad) * v;
    const W = this.getW(), H = this.getH();
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(244,236,223,.5)';
    for (let i = 0; i < 70; i++) {
      for (let s = 0; s < 6; s++) {
        vy += GRAV * 4; vx += wind * 4; x += vx * 4; y += vy * 4;
      }
      if (x < 0 || x > W || y > H || terrain.collisionAt(x, y)) break;
      if (i % 2 === 0) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    this.ctx.restore();
  }

  drawProjectiles(projectiles: ActiveProjectile[]): void {
    for (const p of projectiles) {
      if (p.dead) continue;
      this.ctx.beginPath();
      for (let i = 0; i < p.trail.length; i++) {
        const pt = p.trail[i];
        if (i === 0) this.ctx.moveTo(pt.x, pt.y);
        else this.ctx.lineTo(pt.x, pt.y);
      }
      this.ctx.strokeStyle = 'rgba(255,206,107,.45)';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      this.ctx.fillStyle = '#fff4d8';
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ff7a3c';
      this.ctx.fill();
    }
  }

  drawTracerMarker(x: number, y: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#9af7c9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x + 10, y);
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x, y + 10);
    ctx.stroke();
    ctx.fillStyle = '#9af7c9';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TRACER', x, y - 14);
    ctx.restore();
  }

  updateParticles(particles: Particle[], dt: number): void {
    updateAndDrawParticles(particles, this.ctx, dt);
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.arcTo(x + w, y, x + w, y + h, r);
    this.ctx.arcTo(x + w, y + h, x, y + h, r);
    this.ctx.arcTo(x, y + h, x, y, r);
    this.ctx.arcTo(x, y, x + w, y, r);
    this.ctx.closePath();
  }
}
