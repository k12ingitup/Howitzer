import { WEAPONS } from '../weapons/registry';

export function renderArsenal(
  container: HTMLElement,
  selectedIndex: number,
  onSelect: (i: number) => void
): void {
  container.innerHTML = '';
  WEAPONS.forEach((w, i) => {
    const b = document.createElement('button');
    b.className = 'wep' + (i === selectedIndex ? ' on' : '');
    b.innerHTML = w.name + '<small>' + w.sub + '</small>';
    b.onclick = () => onSelect(i);
    container.appendChild(b);
  });
}
