export interface HUDData {
  p1Name: string; p2Name: string;
  p1Score: number; p2Score: number;
  p1ShotsLeft: number; p2ShotsLeft: number;
  p1HP: number; p2HP: number;
  wind: number;
  turn: number; phase: string;
  p1AI: boolean; p2AI: boolean;
  mode: string;
  accentColor: string;
}

export function syncHUD(data: HUDData): void {
  const $ = (id: string) => document.getElementById(id)!;
  $('n1').textContent = data.p1Name;
  $('n2').textContent = data.p2Name;

  if (data.mode === 'score') {
    $('h1').textContent = String(data.p1Score);
    $('h2').textContent = String(data.p2Score);
    ($('c1').querySelector('i') as HTMLElement).style.width = Math.min(100, data.p1Score) + '%';
    ($('c2').querySelector('i') as HTMLElement).style.width = Math.min(100, data.p2Score) + '%';
    const s1 = $('shots1'); if (s1) s1.textContent = `${data.p1ShotsLeft} shots left`;
    const s2 = $('shots2'); if (s2) s2.textContent = `${data.p2ShotsLeft} shots left`;
  } else {
    $('h1').textContent = String(data.p1HP);
    $('h2').textContent = String(data.p2HP);
    ($('c1').querySelector('i') as HTMLElement).style.width = data.p1HP + '%';
    ($('c2').querySelector('i') as HTMLElement).style.width = data.p2HP + '%';
    const s1 = $('shots1'); if (s1) s1.textContent = '';
    const s2 = $('shots2'); if (s2) s2.textContent = '';
  }

  const w = data.wind;
  const mag = Math.abs(w / 0.0009);
  const arrow = w > 0.00002 ? '→' : w < -0.00002 ? '←' : '•';
  $('windVal').textContent = arrow + ' ' + (mag * 10).toFixed(1);

  const turnName = data.turn === 0 ? data.p1Name : data.p2Name;
  const isAI = data.turn === 0 ? data.p1AI : data.p2AI;
  $('turnTag').textContent =
    data.phase === 'aim' ? turnName + (isAI ? ' is aiming…' : ' to fire') :
    data.phase === 'over' ? '' : 'Shot in flight';

  document.documentElement.style.setProperty('--accent', data.accentColor);
}
