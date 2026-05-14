import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
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
  @Input() variant: 'default' | 'underlined' = 'default';
  @Input() phoneMaxDigits = 11;

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
    if (this.variant === 'underlined') {
      const baseClass = 'grid min-h-10 items-center border-b transition-all duration-200';
      const layoutClass = this.suffixText ? 'grid-cols-[1fr_auto]' : 'grid-cols-1';
      const stateClass = this.hasError
        ? 'border-[#D30005]'
        : 'border-[var(--color-border)] focus-within:border-[var(--color-accent)]';
      return [baseClass, layoutClass, stateClass].join(' ');
    }

    const baseClass =
      'grid min-h-9 items-center rounded-[8px] border bg-[#F5F5F5] transition-all duration-200 focus-within:ring-2';

    const layoutClass = this.suffixText ? 'grid-cols-[1fr_auto]' : 'grid-cols-1';

    const stateClass = this.hasError
      ? 'border-[#D30005] focus-within:border-[#D30005] focus-within:ring-[#FFE5E5]'
      : 'border-[#CACACB] focus-within:border-[#111111] focus-within:ring-[rgba(39,93,197,0.15)]';

    return [baseClass, layoutClass, stateClass].join(' ');
  }

  protected get inputClasses(): string {
    return [
      'h-full w-full bg-transparent px-3 text-sm text-[var(--color-input-text)] outline-none placeholder:text-[var(--color-input-placeholder)]',
      'disabled:cursor-not-allowed disabled:text-[var(--color-text-tertiary)]'
    ].join(' ');
  }

  protected get isPhoneInput(): boolean {
    return this.type === 'tel';
  }

  protected get displayValue(): string {
    if (!this.isPhoneInput) {
      return this.value;
    }

    const normalized = normalizePhoneDigits(this.value, this.phoneMaxDigits);
    return formatPhoneDisplay(normalized);
  }

  protected get inputModeAttr(): string | null {
    return this.isPhoneInput ? 'numeric' : null;
  }

  // ControlValueAccessor implementation
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string): void {
    if (this.isPhoneInput) {
      this.value = normalizePhoneDigits(value || '', this.phoneMaxDigits);
      return;
    }

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

  protected onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
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
