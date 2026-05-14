export function parseNumber(value: string | number | undefined | null, fallback: number): number {
    if (typeof value === 'number') return value;
    if (!value) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseOptionalNumber(value: string | number | undefined | null): number | undefined {
    if (typeof value === 'number') return value;
    if (value === undefined || value === null) return undefined;
    
    const normalized = String(value).trim();
    if (!normalized) return undefined;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
}
