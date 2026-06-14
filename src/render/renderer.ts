import { CFG } from '../config';
import { Terrain } from '../engine/terrain';
import { ActiveProjectile } from '../weapons/types';
import { Particle, updateAndDrawParticles } from './particles';
import { Tank } from '../weapons/behaviors';

export interface ScorePopup {
  x: number; y: number;
  text: string;
  life: number;
  color: string;
  small?: boolean;
}

export class Renderer {
  private skyGrad: CanvasGradient | null = null;
  private skyKey = '';
  public shake = 0;
  public flashAlpha = 0;

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

  drawFlash(dt: number): void {
    if (this.flashAlpha <= 0) return;
    const W = this.getW(), H = this.getH();
    this.ctx.save();
    this.ctx.globalAlpha = this.flashAlpha;
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(0, 0, W, H);
    this.ctx.restore();
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 0.006);
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

  drawTank(t: Tank, active: boolean, phase: string, angleRad: number): void {
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

  drawAimArc(tank: Tank, angleDeg: number, power: number, wind: number, terrain: Terrain): void {
    const rad = angleDeg * Math.PI / 180;
    const v = power * CFG.POWER_SCALE * 0.06;
    let x = tank.x + Math.cos(rad) * 22;
    let y = tank.y - 14 - Math.sin(rad) * 22;
    let vx = Math.cos(rad) * v;
    let vy = -Math.sin(rad) * v;
    const W = this.getW(), H = this.getH();
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(244,236,223,.5)';
    for (let i = 0; i < 240; i++) {
      for (let s = 0; s < CFG.SUBSTEPS; s++) {
        vy += CFG.GRAV * 4; vx += wind * 4; x += vx * 4; y += vy * 4;
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
    const ctx = this.ctx;
    for (const p of projectiles) {
      if (p.dead) continue;
      const col = p.weapon.color;
      const kind = p.weapon.kind;

      // Roller — spinning ball on surface
      if (p.rolling) {
        ctx.beginPath(); ctx.arc(p.x, p.y - 5, 7, 0, Math.PI * 2);
        ctx.fillStyle = col; ctx.fill();
        ctx.beginPath(); ctx.arc(p.x, p.y - 5, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
        continue;
      }

      // Tunneler underground — surface ripple rings at entry point
      if (p.tunneling) {
        const ex = p.tunnelEntryX ?? p.x;
        const ey = p.tunnelEntryY ?? p.y;
        const progress = 1 - (p.tunnelSteps ?? 0) / 70;
        ctx.save();
        for (let ring = 0; ring < 3; ring++) {
          const rp = (progress + ring * 0.28) % 1;
          ctx.globalAlpha = (1 - rp) * 0.55;
          ctx.strokeStyle = col;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(ex, ey, rp * 28, rp * 8, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
        continue;
      }

      // Tracer — bright green dart
      if (kind === 'tracer') {
        if (p.trail.length > 1) {
          ctx.save();
          ctx.strokeStyle = col;
          ctx.lineWidth = 2;
          ctx.shadowColor = col;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          for (let i = 0; i < p.trail.length; i++) {
            const pt = p.trail[i];
            i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
          ctx.restore();
        }
        ctx.save();
        ctx.shadowColor = col; ctx.shadowBlur = 10;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        continue;
      }

      // Homing — glowing purple orb with dashed trail
      if (kind === 'homing') {
        if (p.trail.length > 1) {
          ctx.save();
          ctx.setLineDash([4, 5]);
          ctx.strokeStyle = col + '88';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let i = 0; i < p.trail.length; i++) {
            const pt = p.trail[i];
            i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
        ctx.save();
        // outer glow
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 14);
        g.addColorStop(0, col + 'cc');
        g.addColorStop(0.5, col + '55');
        g.addColorStop(1, col + '00');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2); ctx.fill();
        // core orb
        ctx.shadowColor = col; ctx.shadowBlur = 12;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        continue;
      }

      // Shell / Heavy / Baby / Sniper / etc — elongated capsule in velocity direction
      const speed = Math.hypot(p.vx, p.vy) + 0.001;
      const nx = p.vx / speed, ny = p.vy / speed;
      const len = kind === 'single' ? 10 : 8;

      // Smoke trail
      if (p.trail.length > 1) {
        ctx.beginPath();
        for (let i = 0; i < p.trail.length; i++) {
          const pt = p.trail[i]; const a = i / p.trail.length;
          i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y);
          void a;
        }
        ctx.strokeStyle = 'rgba(200,180,150,0.25)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Capsule body
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(ny, nx));
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(0, 0, len, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // nose highlight
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.ellipse(len * 0.3, -1, len * 0.3, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawTracerMarkers(markers: Array<{ x: number; y: number; offset: number }>): void {
    const ctx = this.ctx;
    ctx.save();
    for (const m of markers) {
      const label = m.offset === 0 ? '0°' : (m.offset > 0 ? `+${m.offset}°` : `${m.offset}°`);
      // vertical pulse line
      ctx.strokeStyle = '#00ff66';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y - 28);
      ctx.lineTo(m.x, m.y + 6);
      ctx.stroke();
      // crosshair
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(m.x - 8, m.y); ctx.lineTo(m.x + 8, m.y);
      ctx.stroke();
      // dot
      ctx.fillStyle = '#00ff66';
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
      ctx.fill();
      // angle label
      ctx.font = 'bold 12px ui-monospace,monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#00ff66';
      ctx.shadowColor = 'rgba(0,255,102,.8)';
      ctx.shadowBlur = 6;
      ctx.fillText(label, m.x, m.y - 32);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawScorePopups(popups: ScorePopup[], dt: number): void {
    const ctx = this.ctx;
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.life -= dt * 0.0015;
      p.y -= dt * 0.055;
      if (p.life <= 0) { popups.splice(i, 1); continue; }
      const alpha = Math.min(1, p.life * 2.5);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = p.small ? 'bold 13px ui-monospace,monospace' : 'bold 28px ui-monospace,monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,.8)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }
  }

  drawTurnBanner(text: string, alpha: number): void {
    if (alpha <= 0) return;
    const W = this.getW(), H = this.getH();
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(8,6,14,.75)';
    ctx.fillRect(0, H * 0.38, W, 64);
    ctx.fillStyle = '#f4ecdf';
    ctx.font = 'bold 20px ui-sans-serif,system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, W / 2, H * 0.38 + 40);
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
