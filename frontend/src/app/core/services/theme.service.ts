import { Injectable, signal } from '@angular/core';

export type Theme = 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>('light');
  readonly isDark = () => false;

  toggle(): void {
    // Light-only mode — no toggle needed
  }

  setTheme(_theme: Theme): void {
    // Light-only mode — always light
  }
}
