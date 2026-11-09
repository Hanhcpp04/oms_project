import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type UiCardTone = 'default' | 'soft' | 'muted';
export type UiCardPadding = 'none' | 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-ui-card',
  standalone: true,
  templateUrl: './ui-card.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiCardComponent {
  @Input() tone: UiCardTone = 'default';
  @Input() padding: UiCardPadding = 'md';
  @Input() interactive = false;
  @Input() selected = false;
  @Input() rounded = true;
  @Input() className = '';

  protected get cardClasses(): string {
    const baseClass = `w-full border transition-colors duration-200 ${this.rounded ? 'rounded-[var(--radius-sm)]' : 'rounded-none'}`;

    const toneClasses: Record<UiCardTone, string> = {
      default: 'border-[var(--color-border)] bg-[var(--color-surface)]',
      soft: 'border-transparent bg-[var(--color-surface-secondary)]',
      muted: 'border-[var(--color-border)] bg-[var(--color-surface-secondary)]'
    };

    const paddingClasses: Record<UiCardPadding, string> = {
      none: 'p-0',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-5'
    };

    const interactiveClass = this.interactive
      ? 'cursor-pointer hover:border-[var(--color-border-hover)] hover:bg-[var(--color-surface-hover)]'
      : '';

    const selectedClass = this.selected
      ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
      : '';

    return [
      baseClass,
      toneClasses[this.tone],
      paddingClasses[this.padding],
      interactiveClass,
      selectedClass,
      this.className
    ]
      .filter(Boolean)
      .join(' ');
  }
}
