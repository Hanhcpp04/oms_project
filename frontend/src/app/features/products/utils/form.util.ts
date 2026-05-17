import { parseVndCurrencyInput } from '../../../shared/utils/currency.util';

export function parseNumber(value: string | number | undefined | null, fallback: number): number {
    const parsed = parseVndCurrencyInput(value);
    return parsed !== undefined && Number.isFinite(parsed) ? parsed : fallback;
}

export function parseOptionalNumber(value: string | number | undefined | null): number | undefined {
    const parsed = parseVndCurrencyInput(value);
    return parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined;
}
