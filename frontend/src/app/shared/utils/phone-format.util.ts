export type PhoneFormatResult = {
  raw: string;
  display: string;
};

export interface CountryPhoneOption {
  label: string;
  value: string;
  dialCode: string;
  placeholder: string;
  maxDigits: number;
  minDigits: number;
  formatter: (digits: string) => string;
  validator: (digits: string) => boolean;
  normalizer: (digits: string) => string;
}

interface CountryPhoneDataResponse {
  cca2?: string;
  name?: {
    common?: string;
  };
  idd?: {
    root?: string;
    suffixes?: string[];
  };
}

export const DEFAULT_PHONE_COUNTRY_CODE = 'VN';
export const COUNTRY_PHONE_DATA_URL = 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json';

export const FALLBACK_COUNTRY_PHONE_OPTIONS: CountryPhoneOption[] = [
  {
    label: 'Vietnam',
    value: 'VN',
    dialCode: '+84',
    placeholder: '090-000-0000',
    maxDigits: 10,
    minDigits: 9,
    formatter: formatVietnamPhone,
    validator: isValidVietnamPhone,
    normalizer: normalizeVietnamPhone
  },
  {
    label: 'United States',
    value: 'US',
    dialCode: '+1',
    placeholder: '555-123-4567',
    maxDigits: 10,
    minDigits: 10,
    formatter: formatTenDigitPhone,
    validator: (digits) => /^\d{10}$/.test(digits),
    normalizer: (digits) => `+1${digits}`
  },
  {
    label: 'Singapore',
    value: 'SG',
    dialCode: '+65',
    placeholder: '9123-4567',
    maxDigits: 8,
    minDigits: 8,
    formatter: (digits) => [digits.slice(0, 4), digits.slice(4, 8)].filter(Boolean).join('-'),
    validator: (digits) => /^\d{8}$/.test(digits),
    normalizer: (digits) => `+65${digits}`
  }
];

export function normalizePhoneDigits(value: string, maxDigits = 11): string {
  return value.replace(/\D/g, '').slice(0, maxDigits);
}

export function formatPhoneDisplay(raw: string): string {
  if (!raw) return '';

  if (raw.startsWith('1800') || raw.startsWith('1900')) {
    const part1 = raw.slice(0, 4);
    const part2 = raw.slice(4, 7);
    const part3 = raw.slice(7);
    return [part1, part2, part3].filter(Boolean).join('.');
  }

  if (raw.length <= 3) return raw;
  if (raw.length <= 6) return `${raw.slice(0, 3)}.${raw.slice(3)}`;
  if (raw.length <= 10) return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6)}`;
  return `${raw.slice(0, 3)}.${raw.slice(3, 7)}.${raw.slice(7)}`;
}

export function formatPhoneInput(value: string, maxDigits = 11): PhoneFormatResult {
  const raw = normalizePhoneDigits(value, maxDigits);
  return { raw, display: formatPhoneDisplay(raw) };
}

export function getCountryPhoneOption(
  value: string,
  options: CountryPhoneOption[] = FALLBACK_COUNTRY_PHONE_OPTIONS
): CountryPhoneOption {
  return options.find((option) => option.value === value) ?? FALLBACK_COUNTRY_PHONE_OPTIONS[0];
}

export function formatPhoneForCountry(value: string, option: CountryPhoneOption): string {
  const digits = normalizePhoneDigits(value, option.maxDigits);
  return option.formatter(digits);
}

export function isPhoneValidForCountry(value: string, option: CountryPhoneOption): boolean {
  const digits = normalizePhoneDigits(value, option.maxDigits);
  return !digits || option.validator(digits);
}

export function normalizePhoneForCountry(value: string, option: CountryPhoneOption): string {
  const digits = normalizePhoneDigits(value, option.maxDigits);
  return digits ? option.normalizer(digits) : '';
}

export function parseInternationalPhone(
  value: string,
  options: CountryPhoneOption[] = FALLBACK_COUNTRY_PHONE_OPTIONS
): { country: CountryPhoneOption; localDisplay: string } {
  const trimmed = value.trim();

  if (!trimmed.startsWith('+')) {
    const country = FALLBACK_COUNTRY_PHONE_OPTIONS[0];
    return { country, localDisplay: formatPhoneForCountry(trimmed, country) };
  }

  const country = [...options]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((option) => trimmed.startsWith(option.dialCode)) ?? FALLBACK_COUNTRY_PHONE_OPTIONS[0];
  const localDigits = trimmed.slice(country.dialCode.length);
  return { country, localDisplay: formatPhoneForCountry(localDigits, country) };
}

export async function loadCountryPhoneOptions(): Promise<CountryPhoneOption[]> {
  try {
    const response = await fetch(COUNTRY_PHONE_DATA_URL);

    if (!response.ok) {
      return FALLBACK_COUNTRY_PHONE_OPTIONS;
    }

    const countries = (await response.json()) as CountryPhoneDataResponse[];
    const options = countries
      .flatMap(toCountryPhoneOptions)
      .sort(sortCountryPhoneOptions);

    return options.length > 0 ? options : FALLBACK_COUNTRY_PHONE_OPTIONS;
  } catch {
    return FALLBACK_COUNTRY_PHONE_OPTIONS;
  }
}

export function getPhoneCountryOptionLabel(country: CountryPhoneOption, expanded: boolean): string {
  return expanded ? `${country.dialCode} · ${country.label}` : country.dialCode;
}

function toCountryPhoneOptions(country: CountryPhoneDataResponse): CountryPhoneOption[] {
  const countryCode = country.cca2?.trim().toUpperCase();
  const root = country.idd?.root?.trim();
  const suffixes = country.idd?.suffixes?.length ? country.idd.suffixes : [''];

  if (!countryCode || !root || root === '+') {
    return [];
  }

  return suffixes
    .map((suffix) => `${root}${suffix}`.replace(/\s/g, ''))
    .filter((dialCode) => /^\+\d+$/.test(dialCode))
    .map((dialCode, index) => createCountryPhoneOption(countryCode, country.name?.common, dialCode, index));
}

function createCountryPhoneOption(
  countryCode: string,
  countryName: string | undefined,
  dialCode: string,
  suffixIndex: number
): CountryPhoneOption {
  if (countryCode === 'VN') return FALLBACK_COUNTRY_PHONE_OPTIONS[0];
  if (countryCode === 'US') return FALLBACK_COUNTRY_PHONE_OPTIONS[1];
  if (countryCode === 'SG') return FALLBACK_COUNTRY_PHONE_OPTIONS[2];

  const countryDialDigits = dialCode.replace(/\D/g, '').length;
  const maxDigits = Math.max(4, 15 - countryDialDigits);
  const minDigits = Math.min(6, maxDigits);

  return {
    label: countryName?.trim() || countryCode,
    value: suffixIndex === 0 ? countryCode : `${countryCode}-${suffixIndex}`,
    dialCode,
    placeholder: buildGenericPhonePlaceholder(maxDigits),
    minDigits,
    maxDigits,
    formatter: formatGenericPhone,
    validator: (digits) => digits.length >= minDigits && digits.length <= maxDigits,
    normalizer: (digits) => `${dialCode}${digits}`
  };
}

function sortCountryPhoneOptions(a: CountryPhoneOption, b: CountryPhoneOption): number {
  if (a.value === DEFAULT_PHONE_COUNTRY_CODE) return -1;
  if (b.value === DEFAULT_PHONE_COUNTRY_CODE) return 1;
  return a.label.localeCompare(b.label);
}

function buildGenericPhonePlaceholder(maxDigits: number): string {
  return formatGenericPhone('0'.repeat(Math.min(maxDigits, 10)));
}

function formatVietnamPhone(digits: string): string {
  if (digits.startsWith('0')) {
    return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean).join('-');
  }

  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(Boolean).join('-');
}

function formatTenDigitPhone(digits: string): string {
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean).join('-');
}

function formatGenericPhone(digits: string): string {
  const groups: string[] = [];
  for (let index = 0; index < digits.length; index += 3) {
    groups.push(digits.slice(index, index + 3));
  }
  return groups.filter(Boolean).join('-');
}

function isValidVietnamPhone(digits: string): boolean {
  return /^0[35789]\d{8}$/.test(digits) || /^[35789]\d{8}$/.test(digits);
}

function normalizeVietnamPhone(digits: string): string {
  const nationalNumber = digits.startsWith('0') ? digits.slice(1) : digits;
  return `+84${nationalNumber}`;
}
