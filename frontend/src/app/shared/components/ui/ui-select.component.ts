import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  label: string;
  value: string;
}

let nextSelectId = 0;

@Component({
  selector: 'app-ui-select',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid gap-1">
      @if (label) {
        <label [for]="resolvedId" class="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
          {{ label }}
        </label>
      }
      <select
        [id]="resolvedId"
        [value]="value"
        [disabled]="disabled"
        (change)="onSelectChange($event)"
        (blur)="onBlur()"
        [class]="selectClasses"
      >
        <option *ngIf="placeholder" value="">{{ placeholder }}</option>
        <option *ngFor="let opt of options" [value]="opt.value">{{ opt.label }}</option>
      </select>
      <p *ngIf="hasError" class="m-0 text-xs font-medium text-[var(--color-danger-text)]">{{ errorText }}</p>
    </div>
  `,
  host: { class: 'block' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiSelectComponent),
      multi: true
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiSelectComponent implements ControlValueAccessor {
  @Input() id = '';
  @Input() label = '';
  @Input() placeholder = '';
  @Input() value = '';
  @Input() options: readonly SelectOption[] = [];
  @Input() disabled = false;
  @Input() errorText = '';
  @Input() variant: 'default' | 'underlined' | 'filter' = 'default';

  @Output() valueChange = new EventEmitter<string>();

  private readonly generatedId = `ui-select-${++nextSelectId}`;

  protected get resolvedId(): string {
    return this.id || this.generatedId;
  }

  protected get hasError(): boolean {
    return this.errorText.trim().length > 0;
  }

  protected get selectClasses(): string {
    if (this.variant === 'filter') {
      const base = 'h-8 w-full rounded-[var(--radius-xs)] border bg-[var(--color-surface)] px-3 text-sm text-[var(--color-input-text)] outline-none transition-none disabled:cursor-not-allowed disabled:opacity-50';
      const state = this.hasError ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)] focus-within:border-[var(--color-border-focus)] focus-within:ring-1 focus-within:ring-[var(--color-focus-ring)]';
      return `${base} ${state}`;
    }

    if (this.variant === 'underlined') {
      const base = 'h-8 w-full border-b bg-transparent text-sm text-[var(--color-input-text)] outline-none transition-none disabled:cursor-not-allowed disabled:opacity-50';
      const state = this.hasError
        ? 'border-[var(--color-danger)]'
        : 'border-[var(--color-border)] focus:border-[var(--color-border-focus)]';
      return `${base} ${state}`;
    }

    const base = 'h-9 w-full rounded-[var(--radius-xs)] border px-3 text-sm text-[var(--color-input-text)] outline-none transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50';
    const state = this.hasError
      ? 'border-[var(--color-danger)] bg-[#FEF2F2] focus:border-[var(--color-danger)] focus:ring-1 focus:ring-[rgba(220,38,38,0.12)]'
      : 'border-[var(--color-input-border)] bg-[var(--color-input-bg)] focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-focus-ring)]';
    return `${base} ${state}`;
  }

  // ControlValueAccessor implementation
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string): void {
    this.value = value || '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  protected onSelectChange(event: Event): void {
    this.value = (event.target as HTMLSelectElement).value;
    this.onChange(this.value);
    this.valueChange.emit(this.value);
  }

  protected onBlur(): void {
    this.onTouched();
  }
}
