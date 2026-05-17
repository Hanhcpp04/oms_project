import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-ui-toggle',
  standalone: true,
  template: `
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="checked"
      [attr.aria-label]="ariaLabel"
      [disabled]="disabled"
      (click)="onToggle()"
      (blur)="onBlur()"
      class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(39,93,197,1)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      [class]="checked
        ? 'bg-[#111111]'
        : 'bg-[#E5E5E5]'"
    >
      <span
        class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white ring-0 transition duration-200"
        [class.translate-x-5]="checked"
        [class.translate-x-0.5]="!checked"
      ></span>
    </button>
  `,
  host: { class: 'inline-flex' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiToggleComponent),
      multi: true
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiToggleComponent implements ControlValueAccessor {
  @Input() checked = false;
  @Input() disabled = false;
  @Input() ariaLabel = '';

  @Output() toggled = new EventEmitter<boolean>();

  // ControlValueAccessor implementation
  private onChange: (value: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: boolean): void {
    this.checked = !!value;
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  protected onToggle(): void {
    if (!this.disabled) {
      const nextValue = !this.checked;
      this.onChange(nextValue);
      this.toggled.emit(nextValue);
    }
  }

  protected onBlur(): void {
    this.onTouched();
  }
}
