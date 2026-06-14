export type MenuMode = 'cpu-easy' | 'cpu-hard' | 'pvp';
export type GameModeChoice = 'score' | 'annihilation';

export function showMainMenu(
  overlay: HTMLElement,
  onStart: (menuMode: MenuMode, gameMode: GameModeChoice) => void
): void {
  overlay.querySelector('.sub')!.textContent = 'Artillery Duel';
  (overlay.querySelector('h1') as HTMLElement).textContent = 'HOWITZER';
  overlay.querySelector('p')!.textContent =
    'Earn points by landing shots near your opponent. Most points after 10 shots wins.';
  overlay.classList.remove('hidden');

  overlay.querySelectorAll('[data-mode]').forEach(btn => {
    const b = btn as HTMLElement;
    b.onclick = () => {
      const menuMode = b.dataset.mode as MenuMode;
      const gameMode = (b.dataset.gamemode as GameModeChoice) ?? 'score';
      onStart(menuMode, gameMode);
    };
  });
}

export function showGameOver(
  overlay: HTMLElement,
  winnerName: string,
  scores: [number, number],
  mode: string,
  onRestart: () => void
): void {
  overlay.querySelector('.sub')!.textContent = 'Battle over';
  (overlay.querySelector('h1') as HTMLElement).textContent =
    winnerName === 'Draw' ? 'DRAW!' : (winnerName + ' WINS').toUpperCase();
  overlay.querySelector('p')!.textContent =
    mode === 'score'
      ? `Final score: ${scores[0]} – ${scores[1]}`
      : (winnerName === 'Draw' ? 'Mutual destruction!' : 'Direct hit. Want a rematch?');
  overlay.classList.remove('hidden');
  void onRestart;
}
