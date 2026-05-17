import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, HostBinding, Input, Output } from '@angular/core';
import {
  formatVndCurrencyInput,
  isCurrencyFieldLike,
  normalizeVndCurrencyInput
} from '../../utils/currency.util';
import { formatPhoneDisplay, formatPhoneInput, normalizePhoneDigits } from '../../utils/phone-format.util';
import {
  DynamicFieldValue,
  DynamicFieldOption,
  DynamicFormContext,
  DynamicFormMode,
  DynamicFormVariant,
  DynamicRenderField,
  getDynamicOptionValue
} from './dynamic-form.types';

@Component({
  selector: 'app-dynamic-form-field',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="wrapperClasses">
      <label [class]="labelClasses">
        {{ field.label }}
        <span *ngIf="field.required" [class]="requiredClasses">*</span>
      </label>

      <ng-container [ngSwitch]="field.type">
        <textarea
          *ngSwitchCase="'textarea'"
          rows="3"
          [class]="textareaClasses"
          [placeholder]="field.placeholder || 'Nhập thông tin'"
          [value]="textValue"
          [disabled]="isDisabled"
          (input)="onTextInput($event)"
        ></textarea>

        <select
          *ngSwitchCase="'select'"
          [class]="inputClasses"
          [value]="textValue"
          [disabled]="isDisabled"
          (change)="onTextInput($event)"
        >
          <option value="">{{ field.placeholder || 'Chọn một giá trị' }}</option>
          <option *ngFor="let option of field.options" [value]="optionValue(option)">{{ option.label }}</option>
        </select>

        <div *ngSwitchCase="'radio'" [class]="choiceGroupClasses">
          <label *ngFor="let option of field.options" [class]="choiceLabelClasses">
            <input
              type="radio"
              [name]="field.id"
              [value]="optionValue(option)"
              [checked]="textValue === optionValue(option)"
              [disabled]="isDisabled"
              [class]="radioClasses"
              (change)="onSingleChoice(optionValue(option))"
            />
            <span [class]="choiceTextClasses">{{ option.label }}</span>
          </label>
        </div>

        <div *ngSwitchCase="'checkbox'" [class]="choiceGroupClasses">
          <label *ngFor="let option of field.options" [class]="choiceLabelClasses">
            <input
              type="checkbox"
              [value]="optionValue(option)"
              [checked]="isChecked(optionValue(option))"
              [disabled]="isDisabled"
              [class]="checkboxClasses"
              (change)="onCheckboxChange(optionValue(option), $event)"
            />
            <span [class]="choiceTextClasses">{{ option.label }}</span>
          </label>
        </div>

        <label *ngSwitchCase="'image'" [class]="imageBoxClasses">
          <img *ngIf="textValue" [src]="textValue" class="h-full w-full object-cover" [alt]="field.label" />
          <span *ngIf="!textValue" [class]="imagePlaceholderClasses">{{ field.placeholder || 'Tải ảnh lên' }}</span>
          <span *ngIf="textValue && !isDisabled" class="absolute inset-0 grid place-items-center bg-black/40 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">Đổi ảnh</span>
          <input *ngIf="!isDisabled" type="file" accept="image/*" class="absolute inset-0 cursor-pointer opacity-0" (change)="onFileInput($event)" />
        </label>

        <label *ngSwitchCase="'file'" [class]="imageBoxClasses">
          <span [class]="imagePlaceholderClasses">{{ textValue || field.placeholder || 'Tải file lên' }}</span>
          <input *ngIf="!isDisabled" type="file" class="absolute inset-0 cursor-pointer opacity-0" (change)="onFileInput($event)" />
        </label>

        <input
          *ngSwitchDefault
          [type]="inputType"
          [attr.inputmode]="inputModeAttr"
          [class]="inputClasses"
          [placeholder]="field.placeholder || 'Nhập thông tin'"
          [value]="displayValue"
          [disabled]="isDisabled"
          (input)="onTextInput($event)"
        />
      </ng-container>

      <p *ngIf="field.helperText && !isPreview" [class]="helperClasses">{{ field.helperText }}</p>
      <p *ngFor="let error of errors" [class]="errorClasses">{{ error }}</p>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DynamicFormFieldComponent {
  @Input({ required: true }) field!: DynamicRenderField;
  @Input() value: DynamicFieldValue = '';
  @Input() mode: DynamicFormMode = 'create';
  @Input() variant: DynamicFormVariant = 'internal';
  @Input('readonly') isReadonly = false;
  @Input() context: DynamicFormContext = 'order';
  @Input() errors: string[] = [];

  @Output() valueChange = new EventEmitter<DynamicFieldValue>();
  @Output() fileSelected = new EventEmitter<File>();

  @HostBinding('class')
  protected get hostClasses(): string {
    const isWide = this.field?.type === 'textarea' || this.field?.type === 'radio' || this.field?.type === 'checkbox' || this.field?.type === 'image' || this.field?.type === 'file';
    if (!isWide) {
      return 'block';
    }

    return this.context === 'order' ? 'block sm:col-span-2' : 'block md:col-span-2';
  }

  protected get isDisabled(): boolean {
    return this.isReadonly || this.mode === 'preview';
  }

  protected get isPreview(): boolean {
    return this.mode === 'preview';
  }

  protected get textValue(): string {
    return typeof this.value === 'string' ? this.value : '';
  }

  protected get displayValue(): string {
    if (this.isCurrencyInput) {
      return formatVndCurrencyInput(this.textValue);
    }

    if (this.field.type === 'phone' && this.context !== 'product') {
      return formatPhoneDisplay(normalizePhoneDigits(this.textValue));
    }

    return this.textValue;
  }

  protected get inputType(): string {
    if (this.isCurrencyInput) {
      return 'text';
    }

    switch (this.field.type) {
      case 'number':
        return 'number';
      case 'phone':
        return 'tel';
      case 'email':
        return 'email';
      case 'date':
        return 'date';
      case 'time':
        return 'time';
      default:
        return 'text';
    }
  }

  protected get inputModeAttr(): string | null {
    return this.field.type === 'phone' || this.isCurrencyInput ? 'numeric' : null;
  }

  protected get isCurrencyInput(): boolean {
    return this.field.type === 'number' && isCurrencyFieldLike(this.field);
  }

  protected get wrapperClasses(): string {
    if (this.context === 'product') {
      return 'grid gap-2';
    }

    return this.variant === 'public'
      ? 'space-y-2 rounded-none border border-[#dfe3e8] bg-white p-4 sm:p-5'
      : 'grid gap-1.5';
  }

  protected get labelClasses(): string {
    if (this.variant === 'public') {
      return 'block text-sm font-medium text-[#111111]';
    }

    if (this.context === 'product') {
      return 'text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7280]';
    }

    return 'text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]';
  }

  protected get requiredClasses(): string {
    return this.variant === 'public' ? 'text-[#D30005]' : 'text-red-500';
  }

  protected get inputClasses(): string {
    if (this.variant === 'public') {
      return 'w-full rounded-none border border-[#d9dde3] bg-white p-3.5 text-sm text-[#111111] transition-all placeholder:text-[#8b949e] focus:border-[#111111] focus:ring-1 focus:ring-[rgba(17,17,17,0.12)] disabled:cursor-not-allowed disabled:opacity-70';
    }

    if (this.context === 'product') {
      return 'h-11 w-full rounded-none border border-[#e5e7eb] bg-white px-3.5 text-sm outline-none transition-all duration-200 focus:border-[#111111] focus:ring-1 focus:ring-[#111111]/15 disabled:cursor-not-allowed disabled:bg-[#f9fafb]';
    }

    return 'h-10 w-full rounded-none border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-3 text-sm text-[var(--color-input-text)] outline-none transition-all duration-200 focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-accent-soft)] disabled:cursor-not-allowed disabled:opacity-70';
  }

  protected get textareaClasses(): string {
    if (this.variant === 'public') {
      return 'w-full rounded-none border border-[#d9dde3] bg-white p-3.5 text-sm text-[#111111] transition-all placeholder:text-[#8b949e] focus:border-[#111111] focus:ring-1 focus:ring-[rgba(17,17,17,0.12)] disabled:cursor-not-allowed disabled:opacity-70';
    }

    if (this.context === 'product') {
      return 'min-h-28 w-full rounded-none border border-[#e5e7eb] bg-white px-3.5 py-3 text-sm outline-none transition-all duration-200 focus:border-[#111111] focus:ring-1 focus:ring-[#111111]/15 disabled:cursor-not-allowed disabled:bg-[#f9fafb]';
    }

    return 'w-full rounded-none border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-input-text)] outline-none transition-all duration-200 placeholder:text-[var(--color-input-placeholder)] focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-accent-soft)] disabled:cursor-not-allowed disabled:opacity-70';
  }

  protected get choiceGroupClasses(): string {
    if (this.context === 'product') {
      return 'grid gap-2 rounded-none border border-[#e5e7eb] bg-[#f8fafc] p-3';
    }

    return this.variant === 'public' ? 'grid gap-2 rounded-none border border-[#d9dde3] bg-white p-3' : 'flex flex-wrap gap-x-4 gap-y-2 py-1';
  }

  protected get choiceLabelClasses(): string {
    if (this.context === 'product') {
      return 'flex items-center gap-2 text-sm font-medium text-[#374151]';
    }

    return this.variant === 'public'
      ? 'flex cursor-pointer items-center gap-2'
      : 'inline-flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-secondary)]';
  }

  protected get choiceTextClasses(): string {
    return this.variant === 'public' ? 'text-sm text-[#41464d]' : '';
  }

  protected get radioClasses(): string {
    if (this.context === 'product') {
      return 'accent-[#111827]';
    }

    return this.variant === 'public'
      ? 'text-[#111111] focus:ring-[#111111]'
      : 'h-4 w-4 rounded-none border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-focus-ring)]';
  }

  protected get checkboxClasses(): string {
    if (this.context === 'product') {
      return 'accent-[#111827]';
    }

    return this.variant === 'public'
      ? 'rounded-none text-[#111111] focus:ring-[#111111]'
      : 'h-4 w-4 rounded-none border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-focus-ring)]';
  }

  protected get imageBoxClasses(): string {
    if (this.variant === 'public') {
      return 'group relative flex h-36 w-full cursor-pointer items-center justify-center overflow-hidden rounded-none border-2 border-dashed border-[#cbd2d9] bg-white text-xs font-semibold text-[#707072] transition hover:border-[#111111]';
    }

    if (this.context === 'product') {
      return 'group relative flex h-32 w-full cursor-pointer items-center justify-center overflow-hidden rounded-none border-2 border-dashed border-[#e5e7eb] bg-white text-xs text-[#6b7280]';
    }

    return 'group relative flex h-32 w-full cursor-pointer items-center justify-center overflow-hidden rounded-none border-2 border-dashed border-[var(--color-input-border)] bg-[var(--color-input-bg)] text-xs text-[var(--color-text-tertiary)]';
  }

  protected get imagePlaceholderClasses(): string {
    return '';
  }

  protected get helperClasses(): string {
    if (this.variant === 'public') {
      return 'text-xs italic text-[#707072]';
    }

    if (this.context === 'product') {
      return 'text-xs text-[#6b7280]';
    }

    return 'm-0 text-xs text-[var(--color-text-tertiary)]';
  }

  protected get errorClasses(): string {
    if (this.variant === 'public') {
      return 'text-xs font-medium text-[#D30005]';
    }

    if (this.context === 'product') {
      return 'text-xs font-semibold text-[#dc2626]';
    }

    return 'm-0 text-xs font-medium text-[var(--color-danger-text)]';
  }

  protected optionValue(option: DynamicFieldOption): string {
    return getDynamicOptionValue(this.field, option, this.context);
  }

  protected isChecked(optionValue: string): boolean {
    return Array.isArray(this.value) && this.value.includes(optionValue);
  }

  protected onTextInput(event: Event): void {
    const input = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    if (this.isCurrencyInput) {
      this.valueChange.emit(normalizeVndCurrencyInput(input.value));
      return;
    }

    if (this.field.type === 'phone' && this.context !== 'product') {
      const formatted = formatPhoneInput(input.value);
      if (input.value !== formatted.display) {
        input.value = formatted.display;
      }
      this.valueChange.emit(formatted.raw);
      return;
    }

    this.valueChange.emit(input.value);
  }

  protected onSingleChoice(value: string): void {
    this.valueChange.emit(value);
  }

  protected onCheckboxChange(value: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const current = Array.isArray(this.value) ? this.value : [];
    const next = checked ? Array.from(new Set([...current, value])) : current.filter((entry) => entry !== value);
    this.valueChange.emit(next);
  }

  protected onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.fileSelected.emit(file);
    }
    input.value = '';
  }
}
