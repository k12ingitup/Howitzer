export class Terrain {
  readonly W: number;
  readonly H: number;
  private height: Float32Array;

  constructor(W: number, H: number) {
    this.W = W;
    this.H = H;
    this.height = new Float32Array(W);
  }

  generate(): void {
    const W = this.W, H = this.H;
    const base = H * 0.72;

    // Central mountain — the defining feature of the map
    const peakX = W * (0.42 + Math.random() * 0.16);
    const peakH = H * (0.30 + Math.random() * 0.18);
    const peakW = W * (0.22 + Math.random() * 0.12);

    // Small random waves for texture
    const waves = [
      { amp: H * 0.055, len: W * 0.28, ph: Math.random() * 7 },
      { amp: H * 0.028, len: W * 0.11, ph: Math.random() * 7 },
    ];

    for (let x = 0; x < W; x++) {
      // Base rolling ground
      let y = base;
      for (const w of waves) y -= w.amp * Math.sin((x / w.len) * Math.PI * 2 + w.ph);

      // Mountain bell curve added on top
      const dx = (x - peakX) / peakW;
      const mountain = peakH * Math.exp(-dx * dx * 2.2);
      y -= mountain;

      this.height[x] = Math.min(H - 10, Math.max(H * 0.12, y));
    }
  }

  // Flatten terrain to a level platform under a tank spawn point
  flattenAt(cx: number, halfWidth: number): void {
    const ix = Math.max(0, Math.min(this.W - 1, Math.round(cx)));
    const target = this.height[ix];
    const x0 = Math.max(0, Math.round(cx - halfWidth));
    const x1 = Math.min(this.W - 1, Math.round(cx + halfWidth));
    for (let x = x0; x <= x1; x++) {
      // smooth blend: fully flat at center, taper at edges
      const t = 1 - Math.abs(x - cx) / halfWidth;
      const blend = t * t;
      this.height[x] = this.height[x] * (1 - blend) + target * blend;
    }
  }

  collisionAt(x: number, y: number): boolean {
    const ix = Math.round(x);
    if (ix < 0 || ix >= this.W) return false;
    return y >= this.height[ix];
  }

  surfaceY(x: number): number {
    const ix = Math.round(x);
    if (ix < 0 || ix >= this.W) return this.H + 50;
    return this.height[ix];
  }

  destroy(cx: number, cy: number, radius: number): void {
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(this.W - 1, Math.ceil(cx + radius));
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const inside = radius * radius - dx * dx;
      if (inside <= 0) continue;
      const floor = cy + Math.sqrt(inside);
      if (floor > this.height[x]) {
        this.height[x] = Math.min(this.H + 40, floor);
      }
    }
  }

  addDirt(cx: number, cy: number, radius: number): void {
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(this.W - 1, Math.ceil(cx + radius));
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const inside = radius * radius - dx * dx;
      if (inside <= 0) continue;
      const top = cy - Math.sqrt(inside);
      if (top < this.height[x]) {
        this.height[x] = Math.max(this.H * 0.15, top);
      }
    }
  }

  resize(newW: number, newH: number, oldH: number): void {
    const oldHeight = this.height;
    const oldW = oldHeight.length;
    const next = new Float32Array(newW);
    for (let x = 0; x < newW; x++) {
      const s = (x / (newW - 1)) * (oldW - 1);
      next[x] = oldHeight[Math.round(s)] / (oldH || newH) * newH;
    }
    (this as { W: number }).W = newW;
    (this as { H: number }).H = newH;
    this.height = next;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = this.W, H = this.H;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x < W; x++) ctx.lineTo(x, this.height[x]);
    ctx.lineTo(W, H);
    ctx.closePath();
    const tg = ctx.createLinearGradient(0, H * 0.3, 0, H);
    tg.addColorStop(0, '#e8b96b');
    tg.addColorStop(1, '#b9853f');
    ctx.fillStyle = tg;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, this.height[0]);
    for (let x = 1; x < W; x++) ctx.lineTo(x, this.height[x]);
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
