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
    const base = this.H * 0.62;
    for (let x = 0; x < this.W; x++) {
      const h =
        Math.sin(x * 0.013) * 38 +
        Math.sin(x * 0.031 + 1.2) * 22 +
        Math.sin(x * 0.007 + 2.5) * 55 +
        Math.sin(x * 0.053 + 0.8) * 12;
      this.height[x] = base + h;
    }
  }

  collisionAt(x: number, y: number): boolean {
    const ix = Math.round(x);
    if (ix < 0 || ix >= this.W) return false;
    return y >= this.height[ix];
  }

  surfaceY(x: number): number {
    const ix = Math.round(x);
    if (ix < 0) return this.H + 50;
    if (ix >= this.W) return this.H + 50;
    return this.height[ix];
  }

  destroy(cx: number, cy: number, radius: number): void {
    const r = radius;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.W - 1, Math.ceil(cx + r));
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      if (Math.abs(dx) > r) continue;
      const depth = Math.sqrt(r * r - dx * dx);
      const craterFloor = cy + depth;
      if (craterFloor > this.height[x]) {
        this.height[x] = craterFloor;
      }
    }
  }

  addDirt(cx: number, cy: number, radius: number): void {
    const r = radius;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.W - 1, Math.ceil(cx + r));
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      if (Math.abs(dx) > r) continue;
      const depth = Math.sqrt(r * r - dx * dx);
      const dirtTop = cy - depth;
      if (dirtTop < this.height[x]) {
        this.height[x] = dirtTop;
      }
    }
  }

  settle(): void {
    // no-op for height-map
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.moveTo(0, this.H);
    for (let x = 0; x < this.W; x++) ctx.lineTo(x, this.height[x]);
    ctx.lineTo(this.W, this.H);
    ctx.closePath();
    const tg = ctx.createLinearGradient(0, this.H * 0.3, 0, this.H);
    tg.addColorStop(0, '#e8b96b');
    tg.addColorStop(1, '#b9853f');
    ctx.fillStyle = tg;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, this.height[0]);
    for (let x = 1; x < this.W; x++) ctx.lineTo(x, this.height[x]);
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  resize(newW: number, newH: number, oldH: number): void {
    const newHeight = new Float32Array(newW);
    for (let x = 0; x < newW; x++) {
      const srcX = Math.min(this.W - 1, Math.round(x * this.W / newW));
      newHeight[x] = this.height[srcX] * newH / oldH;
    }
    (this as { W: number }).W = newW;
    (this as { H: number }).H = newH;
    this.height = newHeight;
  }
}
