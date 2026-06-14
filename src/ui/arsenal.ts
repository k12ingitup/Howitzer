import { Weapon } from '../weapons/types';
import { RARITY_COLOR } from '../weapons/registry';

export function renderArsenal(
  container: HTMLElement,
  weapons: Weapon[],
  selectedIndex: number,
  onSelect: (i: number) => void
): void {
  container.innerHTML = '';
  weapons.forEach((w, i) => {
    const b = document.createElement('button');
    const rarityColor = RARITY_COLOR[w.rarity] ?? RARITY_COLOR.common;
    b.className = 'wep' + (i === selectedIndex ? ' on' : '');
    b.dataset.rarity = w.rarity;
    b.style.setProperty('--wep-color', rarityColor);
    b.style.setProperty('--wep-accent', w.color);
    b.innerHTML =
      `<span class="wep-icon">${w.icon}</span>` +
      `<span class="wep-name">${w.name}</span>` +
      `<span class="wep-sub">${w.sub}</span>`;
    b.title = `${w.name} — ${w.sub}`;
    b.onclick = () => onSelect(i);
    container.appendChild(b);
  });
}
