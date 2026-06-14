export interface AimTarget { x: number; y: number; }

export function setupAimInput(
  canvas: HTMLCanvasElement,
  getTankPos: () => AimTarget | null,
  isAimPhase: () => boolean,
  onAim: (angleDeg: number, power: number) => void
): void {
  let dragging = false;

  function getPos(e: PointerEvent): { x: number; y: number } {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function aimFrom(pos: { x: number; y: number }): void {
    const tank = getTankPos();
    if (!tank) return;
    const dx = pos.x - tank.x;
    const dy = (tank.y - 10) - pos.y;
    let ang = Math.atan2(dy, dx) * 180 / Math.PI;
    if (ang < 0) ang += 360;
    if (ang > 180) ang = ang > 270 ? 0 : 180;
    const dist = Math.hypot(dx, dy);
    const power = Math.max(5, Math.min(100, dist * 0.55));
    onAim(ang, power);
  }

  canvas.addEventListener('pointerdown', e => {
    if (!isAimPhase()) return;
    dragging = true;
    aimFrom(getPos(e));
  });
  canvas.addEventListener('pointermove', e => {
    if (dragging) { e.preventDefault(); aimFrom(getPos(e)); }
  }, { passive: false });
  window.addEventListener('pointerup', () => { dragging = false; });
}
