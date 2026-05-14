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
      'inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(39,93,197,1)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer';

    const radiusClass = this.variant === 'underlined' ? '' : 'rounded-[30px]';

    const sizeClasses: Record<UiButtonSize, string> = {
      sm: this.variant === 'underlined' ? 'h-10 px-0 text-xs gap-1.5' : 'h-8 px-4 text-xs gap-1.5',
      md: this.variant === 'underlined' ? 'h-10 px-0 text-sm gap-2' : 'h-10 px-5 text-sm gap-2',
      lg: this.variant === 'underlined' ? 'h-11 px-0 text-sm gap-2' : 'h-11 px-6 text-sm gap-2'
    };

    const variantClasses: Record<UiButtonVariant, string> = {
      primary:
        'bg-[#111111] text-white hover:bg-[#707072]',
      secondary:
        'border-[1.5px] border-[#CACACB] bg-transparent text-[#111111] hover:border-[#707072] hover:bg-[#F5F5F5]',
      soft:
        'bg-[#F5F5F5] text-[#111111] hover:bg-[#E5E5E5]',
      ghost:
        'bg-transparent text-[#707072] hover:bg-[#F5F5F5] hover:text-[#111111]',
      danger:
        'bg-[#D30005] text-white hover:bg-[#a80004]',
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
