import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  forwardRef,
  signal
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  ValidationErrors,
  Validator
} from '@angular/forms';
import {
  CountryPhoneOption,
  FALLBACK_COUNTRY_PHONE_OPTIONS,
  formatPhoneForCountry,
  getCountryPhoneOption,
  getPhoneCountryOptionLabel,
  isPhoneValidForCountry,
  loadCountryPhoneOptions,
  normalizePhoneForCountry,
  parseInternationalPhone
} from '../../utils/phone-format.util';

@Component({
  selector: 'app-international-phone-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="grid gap-1.5">
      @if (label) {
        <span class="text-xs font-medium text-[#707072]">
          {{ label }} @if (required) { <span class="text-[#D30005]">*</span> }
        </span>
      }

      <div class="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2">
        <div class="relative">
          <label class="sr-only" [for]="countryId">Mã quốc gia</label>
          <select
            [id]="countryId"
            [value]="selectedCountry().value"
            [disabled]="disabled"
            class="h-10 w-full appearance-none rounded-[8px] border border-[#CACACB] bg-[#F5F5F5] px-3 pr-8 text-sm font-medium text-[#111111] outline-none transition focus:border-[#111111] focus:ring-2 focus:ring-[rgba(39,93,197,0.15)] disabled:cursor-not-allowed disabled:text-[#9E9EA0]"
            [class.border-red-400]="hasError"
            (focus)="countrySelectOpen.set(true)"
            (blur)="countrySelectOpen.set(false); markTouched()"
            (change)="onCountryChange($event)"
          >
            @for (country of countryPhoneOptions(); track country.value) {
              <option [value]="country.value">{{ optionLabel(country) }}</option>
            }
          </select>
          <svg
            class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#707072]"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
          </svg>
        </div>

        <div>
          <label class="sr-only" [for]="phoneId">{{ label || 'Số điện thoại' }}</label>
          <input
            [id]="phoneId"
            type="tel"
            autocomplete="tel-national"
            inputmode="numeric"
            [value]="localDisplay()"
            [disabled]="disabled"
            [placeholder]="selectedCountry().placeholder"
            class="h-10 w-full rounded-[8px] border border-[#CACACB] bg-[#F5F5F5] px-3 text-sm text-[#111111] outline-none transition placeholder:text-[#B8B8BA] focus:border-[#111111] focus:ring-2 focus:ring-[rgba(39,93,197,0.15)] disabled:cursor-not-allowed disabled:text-[#9E9EA0]"
            [class.border-red-400]="hasError"
            [attr.aria-invalid]="hasError ? 'true' : 'false'"
            (input)="onPhoneInput($event)"
            (blur)="markTouched()"
          />
        </div>
      </div>

      @if (hasError && errorText) {
        <p class="m-0 text-xs font-medium text-[#D30005]">{{ errorText }}</p>
      }
    </div>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InternationalPhoneInputComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => InternationalPhoneInputComponent),
      multi: true
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InternationalPhoneInputComponent implements OnInit, ControlValueAccessor, Validator {
  private static nextId = 0;

  @Input() label = 'Số điện thoại';
  @Input() required = false;
  @Input() errorText = '';
  @Input() showError = false;
  @Input() set value(value: string | null | undefined) {
    this.writeValue(value ?? '');
  }
  @Output() valueChange = new EventEmitter<string>();
  @Output() validityChange = new EventEmitter<boolean>();

  protected readonly countryPhoneOptions = signal(FALLBACK_COUNTRY_PHONE_OPTIONS);
  protected readonly selectedCountry = signal(FALLBACK_COUNTRY_PHONE_OPTIONS[0]);
  protected readonly localDisplay = signal('');
  protected readonly countrySelectOpen = signal(false);
  protected disabled = false;
  protected touched = false;

  protected readonly countryId = `phone-country-${++InternationalPhoneInputComponent.nextId}`;
  protected readonly phoneId = `phone-number-${InternationalPhoneInputComponent.nextId}`;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  private onValidatorChange: () => void = () => {};

  get hasError(): boolean {
    return this.showError || (this.touched && !this.isValid());
  }

  ngOnInit(): void {
    void this.loadOptions();
  }

  writeValue(value: string | null): void {
    const parsed = parseInternationalPhone(value ?? '', this.countryPhoneOptions());
    this.selectedCountry.set(parsed.country);
    this.localDisplay.set(parsed.localDisplay);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  validate(_: AbstractControl): ValidationErrors | null {
    if (this.required && !this.localDisplay()) {
      return { required: true };
    }

    return this.isValid() ? null : { phoneNumber: true };
  }

  protected optionLabel(country: CountryPhoneOption): string {
    return getPhoneCountryOptionLabel(country, this.countrySelectOpen());
  }

  protected onCountryChange(event: Event): void {
    const country = getCountryPhoneOption((event.target as HTMLSelectElement).value, this.countryPhoneOptions());
    this.selectedCountry.set(country);
    this.localDisplay.set(formatPhoneForCountry(this.localDisplay(), country));
    this.emitValue();
  }

  protected onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatPhoneForCountry(input.value, this.selectedCountry());

    if (input.value !== formatted) {
      input.value = formatted;
    }

    this.localDisplay.set(formatted);
    this.emitValue();
  }

  protected markTouched(): void {
    this.touched = true;
    this.onTouched();
  }

  private async loadOptions(): Promise<void> {
    const options = await loadCountryPhoneOptions();
    this.countryPhoneOptions.set(options);
    const parsed = parseInternationalPhone(this.currentValue(), options);
    this.selectedCountry.set(parsed.country);
    this.localDisplay.set(parsed.localDisplay);
    this.onValidatorChange();
  }

  private emitValue(): void {
    const value = this.currentValue();
    this.onChange(value);
    this.valueChange.emit(value);
    this.validityChange.emit(this.isValid());
    this.onValidatorChange();
  }

  private currentValue(): string {
    return normalizePhoneForCountry(this.localDisplay(), this.selectedCountry());
  }

  private isValid(): boolean {
    if (!this.localDisplay()) {
      return !this.required;
    }

    return isPhoneValidForCountry(this.localDisplay(), this.selectedCountry());
  }
}
