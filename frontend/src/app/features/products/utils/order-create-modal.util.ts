/**
 * Pure utility functions for the order create modal.
 * Extracted from order-create-modal.component.ts to keep the component lean.
 */
import { FormFieldSemanticKey } from '../../../core/models/form-template.model';

export interface ProductFormRow {
    name: string;
    size: string;
    quantity: string;
    unitPrice: string;
}

export function createEmptyProductRow(): ProductFormRow {
    return {
        name: '',
        size: 'Free',
        quantity: '1',
        unitPrice: '0'
    };
}

export function parsePositiveNumber(value: string, fallback: number): number {
    const normalized = value.replace(/[^\d.-]/g, '');
    const parsed = Number(normalized);

    if (Number.isFinite(parsed)) {
        return parsed;
    }

    return fallback;
}

export function parseOptionalPositiveNumber(value: string): number | undefined {
    const normalized = value.replace(/[^\d.-]/g, '').trim();

    if (!normalized) {
        return undefined;
    }

    const parsed = Number(normalized);

    if (!Number.isFinite(parsed)) {
        return undefined;
    }

    return Math.max(0, parsed);
}

export function inferSemanticKeyByLabel(label: string): FormFieldSemanticKey | undefined {
    const normalized = normalizeLabel(label);

    if (normalized.includes('ten khach')) {
        return 'customerName';
    }

    if (normalized.includes('so dien thoai') || normalized === 'sdt') {
        return 'customerPhone';
    }

    if (normalized.includes('dia chi')) {
        return 'customerAddress';
    }

    if (normalized.includes('ghi chu')) {
        return 'note';
    }

    if (normalized.includes('sla')) {
        return 'slaHours';
    }

    if (normalized.includes('ngay nhan') || normalized.includes('tu ngay')) {
        return 'rentFrom';
    }

    if (normalized.includes('ngay tra') || normalized.includes('den ngay')) {
        return 'rentTo';
    }

    if (normalized.includes('tien coc')) {
        return 'depositAmount';
    }

    if (normalized.includes('so luong')) {
        return 'productQuantity';
    }

    if (normalized.includes('san pham')) {
        return 'productName';
    }

    if (normalized.includes('loai don')) {
        return 'orderType';
    }

    return undefined;
}

function normalizeLabel(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}
