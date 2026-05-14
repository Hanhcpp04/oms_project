/**
 * Shared API response utilities.
 * Extracted from orders-api.service.ts and products-api.service.ts
 * to eliminate duplication across feature services.
 */

export interface ApiEnvelope<T> {
    data?: T;
}

export function unwrapApiResponse<T>(value: T | ApiEnvelope<T>): T {
    if (isRecord(value) && 'data' in value) {
        return (value['data'] as T) ?? ({} as T);
    }

    return value as T;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function asString(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number') {
        return String(value);
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function asNumber(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    return fallback;
}

export function asNullableNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    return null;
}

export function asOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
}

export function asOptionalNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string') {
        const normalized = value.replace(/[^\d.-]/g, '');

        if (!normalized) {
            return undefined;
        }

        const parsed = Number(normalized);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return undefined;
}
