import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { formatVndCurrencyInput, normalizeVndCurrencyInput } from '../../utils/currency.util';
import { formatPhoneDisplay, formatPhoneInput, normalizePhoneDigits } from '../../utils/phone-format.util';

let nextUiInputId = 0;

@Component({
  selector: 'app-ui-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ui-input.component.html',
  host: { class: 'block' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiInputComponent),
      multi: true
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiInputComponent implements ControlValueAccessor {
  @Input() id = '';
  @Input() label = '';
  @Input() placeholder = '';
  @Input() type: string = 'text';
  @Input() value = '';
  @Input() name = '';
  @Input() autocomplete = 'off';
  @Input() suffixText = '';
  @Input() helperText = '';
  @Input() errorText = '';
  @Input() disabled = false;
  @Input() readonly = false;
  @Input() required = false;
  @Input() className = '';
  @Input() variant: 'default' | 'underlined' | 'filter' = 'default';
  @Input() phoneMaxDigits = 11;
  @Input() format: 'default' | 'currency' = 'default';

  @Output() valueChange = new EventEmitter<string>();
  @Output() enterPressed = new EventEmitter<string>();
  @Output() blurred = new EventEmitter<void>();

  private readonly generatedId = `ui-input-${++nextUiInputId}`;

  protected get resolvedId(): string {
    return this.id || this.generatedId;
  }

  protected get hasError(): boolean {
    return this.errorText.trim().length > 0;
  }

  protected get wrapperClasses(): string {
    return ['grid gap-1', this.className].filter(Boolean).join(' ');
  }

  protected get shellClasses(): string {
    const layoutClass = this.suffixText ? 'grid-cols-[1fr_auto]' : 'grid-cols-1';

    if (this.variant === 'filter') {
      const baseClass =
        'grid h-8 items-center rounded-[var(--radius-xs)] border bg-[var(--color-surface)] transition-colors';
      const stateClass = this.hasError
        ? 'border-[var(--color-danger)] focus-within:border-[var(--color-danger)]'
        : 'border-[var(--color-border)] focus-within:border-[var(--color-border-focus)] focus-within:ring-1 focus-within:ring-[var(--color-focus-ring)]';
      return [baseClass, layoutClass, stateClass].filter(Boolean).join(' ');
    }

    if (this.variant === 'underlined') {
      const baseClass = 'grid min-h-8 items-center border-b bg-transparent transition-colors';
      const stateClass = this.hasError
        ? 'border-[var(--color-danger)]'
        : 'border-[var(--color-border)] focus-within:border-[var(--color-border-focus)]';
      return [baseClass, layoutClass, stateClass].join(' ');
    }

    const baseClass =
      'grid min-h-9 items-center rounded-[var(--radius-xs)] border bg-[var(--color-surface)] transition-colors duration-200';

    const stateClass = this.hasError
      ? 'border-[var(--color-danger)] focus-within:border-[var(--color-danger)] focus-within:ring-1 focus-within:ring-[rgba(220,38,38,0.12)]'
      : 'border-[var(--color-border)] focus-within:border-[var(--color-border-focus)] focus-within:ring-1 focus-within:ring-[var(--color-focus-ring)]';

    return [baseClass, layoutClass, stateClass].join(' ');
  }

  protected get inputClasses(): string {
    return [
      'h-full w-full bg-transparent px-3 text-sm text-[var(--color-input-text)] outline-none placeholder:text-[var(--color-input-placeholder)]',
      'disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]',
      this.readonly ? 'cursor-default text-[var(--color-text-secondary)]' : ''
    ].join(' ');
  }

  protected get isPhoneInput(): boolean {
    return this.type === 'tel';
  }

  protected get isCurrencyInput(): boolean {
    return this.format === 'currency';
  }

  protected get displayValue(): string {
    if (this.isCurrencyInput) {
      return formatVndCurrencyInput(this.value);
    }

    if (this.isPhoneInput) {
      const normalized = normalizePhoneDigits(this.value, this.phoneMaxDigits);
      return formatPhoneDisplay(normalized);
    }

    return this.value;
  }

  protected get inputTypeAttr(): string {
    return this.isCurrencyInput ? 'text' : this.type;
  }

  protected get inputModeAttr(): string | null {
    return this.isPhoneInput || this.isCurrencyInput ? 'numeric' : null;
  }

  // ControlValueAccessor implementation
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | number | null | undefined): void {
    if (this.isPhoneInput) {
      this.value = normalizePhoneDigits(value === null || value === undefined ? '' : String(value), this.phoneMaxDigits);
      return;
    }

    this.value = value === null || value === undefined ? '' : String(value);
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

  protected onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (this.isCurrencyInput) {
      this.value = normalizeVndCurrencyInput(input.value);
      this.onChange(this.value);
      this.valueChange.emit(this.value);
      return;
    }

    if (this.isPhoneInput) {
      const formatted = formatPhoneInput(input.value, this.phoneMaxDigits);
      this.value = formatted.raw;
      if (input.value !== formatted.display) {
        input.value = formatted.display;
      }
      this.onChange(this.value);
      this.valueChange.emit(this.value);
      return;
    }

    this.value = input.value;
    this.onChange(this.value);
    this.valueChange.emit(this.value);
  }

  protected onBlur(): void {
    this.onTouched();
    this.blurred.emit();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') {
      return;
    }

    const currentValue = this.isPhoneInput ? this.value : (event.target as HTMLInputElement).value;
    this.enterPressed.emit(currentValue);
  }
}
