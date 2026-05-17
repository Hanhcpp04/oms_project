import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

export type UiButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'underlined';
export type UiButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-ui-button',
  standalone: true,
  templateUrl: './ui-button.component.html',
  host: { class: 'inline-block' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiButtonComponent {
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() variant: UiButtonVariant = 'primary';
  @Input() size: UiButtonSize = 'md';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() block = false;
  @Input() className = '';
  @Input() ariaLabel = '';

  @Output() clicked = new EventEmitter<MouseEvent>();

  protected get buttonClasses(): string {
    const baseClass =
      'inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer';

    const radiusClass = this.variant === 'underlined' ? '' : 'rounded-[var(--radius-xs)]';

    const sizeClasses: Record<UiButtonSize, string> = {
      sm: this.variant === 'underlined' ? 'h-8 px-0 text-[12px] gap-1.5' : 'h-7 px-3 text-[12px] gap-1.5',
      md: this.variant === 'underlined' ? 'h-8 px-0 text-[13px] gap-2' : 'h-8 px-4 text-[13px] gap-2',
      lg: this.variant === 'underlined' ? 'h-10 px-0 text-[14px] gap-2' : 'h-9 px-5 text-[14px] gap-2'
    };

    const variantClasses: Record<UiButtonVariant, string> = {
      primary:
        'bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)]',
      secondary:
        'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-surface-hover)]',
      soft:
        'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-tertiary)]',
      ghost:
        'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]',
      danger:
        'bg-[var(--color-danger)] text-[var(--color-text-inverse)] hover:bg-[var(--color-danger-hover)]',
      underlined:
        'bg-transparent text-[var(--color-accent)] border-b border-[var(--color-accent)] hover:text-[var(--color-accent-hover)] hover:border-[var(--color-accent-hover)]'
    };

    const fullWidthClass = this.block ? 'w-full' : '';
    const loadingClass = this.loading ? 'relative !text-transparent pointer-events-none' : '';

    return [baseClass, radiusClass, sizeClasses[this.size], variantClasses[this.variant], fullWidthClass, loadingClass, this.className]
      .filter(Boolean)
      .join(' ');
  }
}
