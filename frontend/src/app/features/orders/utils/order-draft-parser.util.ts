/**
 * Utility functions for parsing order drafts from raw text input.
 * Extracted from products-page.component.ts to keep components lean.
 */
import { AutoOrderDraft, CreateOrderProductInput, OrderType } from '../data-access/models/order.model';

export function parseOrderDraftFromRawText(rawText: string): AutoOrderDraft {
    const lines = rawText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    const content = rawText.toLowerCase();
    const orderType: OrderType | undefined =
        content.includes('cho thuê') || content.includes('thue')
            ? 'RENT'
            : content.includes('bán') || content.includes('ban')
                ? 'SELL'
                : undefined;

    const customerName = findByPrefixes(lines, ['ten', 'ten khach', 'khach hang', 'customer']);
    const customerPhone =
        findByPrefixes(lines, ['sdt', 'so dien thoai', 'phone']) ??
        extractByRegex(rawText, /(?:\+84|84|0)(?:\d[ .-]?){8,10}/);
    const customerAddress = findByPrefixes(lines, ['dia chi', 'address']);
    const note = findByPrefixes(lines, ['ghi chu', 'note']);
    const slaHours = parseSlaHours(lines);
    const products = parseProductsFromLines(lines);
    const rentFrom = normalizeDateCandidate(findByPrefixes(lines, ['ngay nhan', 'rent from', 'tu ngay']));
    const rentTo = normalizeDateCandidate(findByPrefixes(lines, ['ngay tra', 'rent to', 'den ngay']));

    return {
        orderType,
        customerName,
        customerPhone,
        customerAddress,
        customerNote: note,
        products: products.length > 0 ? products : undefined,
        rentFrom,
        rentTo
    };
}

export function mergeDraftKeepingBaseProduct(baseDraft: AutoOrderDraft, parsedDraft: AutoOrderDraft): AutoOrderDraft {
    const baseProducts = baseDraft.products ?? [];
    const parsedProducts = parsedDraft.products ?? [];
    const productMap = new Map<string, CreateOrderProductInput>();

    for (const product of [...baseProducts, ...parsedProducts]) {
        const key = `${normalizeTextKey(product.name)}|${normalizeTextKey(product.size)}`;

        if (!productMap.has(key)) {
            productMap.set(key, product);
        }
    }

    return {
        orderType: parsedDraft.orderType ?? baseDraft.orderType,
        customerName: parsedDraft.customerName ?? baseDraft.customerName,
        customerPhone: parsedDraft.customerPhone ?? baseDraft.customerPhone,
        customerAddress: parsedDraft.customerAddress ?? baseDraft.customerAddress,
        customerNote: parsedDraft.customerNote ?? baseDraft.customerNote,
        sourceChannel: parsedDraft.sourceChannel ?? baseDraft.sourceChannel,
        shippingMethod: parsedDraft.shippingMethod ?? baseDraft.shippingMethod,
        shippingFee: parsedDraft.shippingFee ?? baseDraft.shippingFee,
        products: Array.from(productMap.values()),
        rentFrom: parsedDraft.rentFrom ?? baseDraft.rentFrom,
        rentTo: parsedDraft.rentTo ?? baseDraft.rentTo,
        depositPaid: parsedDraft.depositPaid ?? baseDraft.depositPaid
    };
}

function normalizeTextKey(value: string): string {
    return value.trim().toLowerCase();
}

function findByPrefixes(lines: string[], prefixes: string[]): string | undefined {
    const normalizedPrefixes = prefixes.map((prefix) => prefix.toLowerCase());

    for (const line of lines) {
        const lower = line.toLowerCase();

        for (const prefix of normalizedPrefixes) {
            const fullPrefixWithColon = `${prefix}:`;

            if (lower.startsWith(fullPrefixWithColon)) {
                const value = line.slice(fullPrefixWithColon.length).trim();
                if (value) {
                    return value;
                }
            }

            if (lower.startsWith(prefix + ' -')) {
                const value = line.slice(prefix.length + 2).trim();
                if (value) {
                    return value;
                }
            }
        }
    }

    return undefined;
}

function parseSlaHours(lines: string[]): number | undefined {
    for (const line of lines) {
        const lower = line.toLowerCase();
        if (!lower.includes('sla') && !lower.includes('gio')) {
            continue;
        }

        const matched = line.match(/(\d{1,3})/);
        if (matched) {
            return Number(matched[1]);
        }
    }

    return undefined;
}

function parseProductsFromLines(lines: string[]): CreateOrderProductInput[] {
    const products: CreateOrderProductInput[] = [];

    for (const line of lines) {
        const lower = line.toLowerCase();

        if (
            lower.startsWith('ten') ||
            lower.startsWith('sdt') ||
            lower.startsWith('so dien thoai') ||
            lower.startsWith('dia chi') ||
            lower.startsWith('ghi chu') ||
            lower.startsWith('customer')
        ) {
            continue;
        }

        const segments = line
            .split(/[|;]/)
            .map((segment) => segment.trim())
            .filter((segment) => segment.length > 0);

        if (segments.length < 3) {
            continue;
        }

        const name = segments[0];
        const size = segments[1] || 'Free';
        const quantity = parsePositiveNumber(segments[2] ?? '1', 1);
        const unitPrice = parsePositiveNumber(segments[3] ?? '0', 0);

        if (!name) {
            continue;
        }

        products.push({
            name,
            size,
            quantity: Math.max(1, Math.round(quantity)),
            unitPrice: Math.max(0, Math.round(unitPrice))
        });
    }

    return products;
}

function extractByRegex(input: string, regex: RegExp): string | undefined {
    const matched = input.match(regex);
    return matched?.[0]?.trim();
}

function parsePositiveNumber(value: string, fallback: number): number {
    const normalized = value.replace(/[^\d.-]/g, '');
    const parsed = Number(normalized);

    if (Number.isFinite(parsed)) {
        return parsed;
    }

    return fallback;
}

function normalizeDateCandidate(value: string | undefined): string | undefined {
    if (!value) {
        return undefined;
    }

    const dateOnly = value.match(/\d{4}-\d{2}-\d{2}/);
    if (dateOnly) {
        return dateOnly[0];
    }

    const dayFirst = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dayFirst) {
        const day = dayFirst[1].padStart(2, '0');
        const month = dayFirst[2].padStart(2, '0');
        return `${dayFirst[3]}-${month}-${day}`;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return undefined;
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
