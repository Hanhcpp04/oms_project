import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type StatTrend = 'up' | 'down' | 'neutral';
export type UiStatCardDensity = 'default' | 'compact';

@Component({
  selector: 'app-ui-stat-card',
  standalone: true,
  template: `
    <div [class]="cardClasses">
      <div class="flex items-start justify-between gap-2">
        <p [class]="labelClasses">
          {{ label }}
        </p>
        @if (icon) {
          <span [class]="iconClasses">
            {{ icon }}
          </span>
        }
      </div>
      <p [class]="valueClasses">
        {{ value }}
      </p>
      @if (trendText) {
        <div [class]="trendWrapClasses">
          <span [class]="trendBadgeClass">
            {{ trendIcon }} {{ trendText }}
          </span>
        </div>
      }
    </div>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiStatCardComponent {
  @Input() label = '';
  @Input() value: string | number = '';
  @Input() trendText = '';
  @Input() trend: StatTrend = 'neutral';
  @Input() icon = '';
  @Input() density: UiStatCardDensity = 'default';

  protected get cardClasses(): string {
    return [
      'group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors duration-200 hover:border-[var(--color-text-primary)]',
      this.density === 'compact' ? 'p-3' : 'p-4'
    ]
      .filter(Boolean)
      .join(' ');
  }

  protected get labelClasses(): string {
    return this.density === 'compact'
      ? 'm-0 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]'
      : 'm-0 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]';
  }

  protected get valueClasses(): string {
    return this.density === 'compact'
      ? 'm-0 mt-1 text-xl font-bold text-[var(--color-text-primary)]'
      : 'm-0 mt-2 text-2xl font-bold text-[var(--color-text-primary)]';
  }

  protected get iconClasses(): string {
    return this.density === 'compact'
      ? 'inline-flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#F5F5F5] text-xs'
      : 'inline-flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#F5F5F5] text-sm';
  }

  protected get trendWrapClasses(): string {
    return this.density === 'compact' ? 'mt-1 flex items-center gap-1' : 'mt-1.5 flex items-center gap-1';
  }

  protected get trendIcon(): string {
    switch (this.trend) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      default:
        return '';
    }
  }

  protected get trendBadgeClass(): string {
    if (this.density === 'compact') {
      return 'inline-flex h-5 items-center rounded-full bg-[var(--color-bg)] px-1.5 text-[10px] font-medium text-[var(--color-text-primary)]';
    }

    switch (this.trend) {
      case 'up':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'down':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-[var(--color-bg)] text-[var(--color-text-tertiary)]';
    }
  }
}
