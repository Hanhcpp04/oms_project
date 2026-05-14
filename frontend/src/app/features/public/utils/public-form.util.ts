import { FormFieldSemanticKey, FormTemplate, FormTemplateField } from '../../../core/models/form-template.model';

export interface ProductContextInfo {
    productId: string;
    productName: string;
    productSize: string;
    quantity: number;
    unitPrice: number;
    orderType: string;
}

export function readProductContextFromQuery(getParam: (key: string) => string | null): ProductContextInfo | null {
    const productName = (getParam('productName') ?? '').trim();

    if (!productName) {
        return null;
    }

    const quantity = parseNumberSafe(getParam('qty'), 1);
    const unitPrice = parseNumberSafe(getParam('unitPrice'), 0);

    return {
        productId: (getParam('productId') ?? '').trim(),
        productName,
        productSize: (getParam('productSize') ?? 'Free').trim() || 'Free',
        quantity: Math.max(1, Math.round(quantity)),
        unitPrice: Math.max(0, Math.round(unitPrice)),
        orderType: (getParam('orderType') ?? '').trim().toUpperCase()
    };
}

export function applyProductContextPrefill(
    template: FormTemplate,
    currentValues: Record<string, string | string[]>,
    productContext: ProductContextInfo | null,
    formatCurrencyFn: (val: number) => string
): Record<string, string | string[]> {
    if (!productContext) {
        return currentValues;
    }

    const nextValues: Record<string, string | string[]> = { ...currentValues };

    template.fields.forEach((field) => {
        if (field.type === 'multi_choice') {
            return;
        }

        const semanticKey = resolveFieldSemanticKey(field);

        if (semanticKey === 'productName') {
            nextValues[field.id] = `${productContext.productName} (${productContext.productSize})`;
            return;
        }

        if (semanticKey === 'productQuantity') {
            nextValues[field.id] = String(productContext.quantity);
            return;
        }

        if (semanticKey === 'orderType') {
            const orderTypeLabel = productContext.orderType === 'RENT' ? 'Cho thuê' : 'Bán';
            nextValues[field.id] = orderTypeLabel;
            return;
        }

        if (semanticKey === 'note') {
            const orderTypeLabel = productContext.orderType === 'RENT' ? 'Cho thuê' : 'Bán';
            nextValues[field.id] = `SP: ${productContext.productName} | Ma: ${productContext.productId || '--'} | Don gia: ${formatCurrencyFn(productContext.unitPrice)} | Loai: ${orderTypeLabel}`;
            return;
        }

        const normalizedLabel = normalizeSearchText(field.label);

        if (normalizedLabel.includes('san pham')) {
            nextValues[field.id] = `${productContext.productName} (${productContext.productSize})`;
            return;
        }

        if (normalizedLabel.includes('so luong')) {
            nextValues[field.id] = String(productContext.quantity);
            return;
        }

        if (normalizedLabel.includes('ghi chu')) {
            const orderTypeLabel = productContext.orderType === 'RENT' ? 'Cho thuê' : 'Bán';
            nextValues[field.id] = `SP: ${productContext.productName} | Ma: ${productContext.productId || '--'} | Don gia: ${formatCurrencyFn(productContext.unitPrice)} | Loai: ${orderTypeLabel}`;
        }
    });

    return nextValues;
}

export function resolveFieldSemanticKey(field: FormTemplateField): FormFieldSemanticKey | undefined {
    if (field.semanticKey) {
        return field.semanticKey;
    }

    const normalizedLabel = normalizeSearchText(field.label);

    if (normalizedLabel.includes('ten khach')) {
        return 'customerName';
    }

    if (normalizedLabel.includes('so dien thoai') || normalizedLabel === 'sdt') {
        return 'customerPhone';
    }

    if (normalizedLabel.includes('dia chi')) {
        return 'customerAddress';
    }

    if (normalizedLabel.includes('ghi chu')) {
        return 'note';
    }

    if (normalizedLabel.includes('sla')) {
        return 'slaHours';
    }

    if (normalizedLabel.includes('ngay nhan') || normalizedLabel.includes('tu ngay')) {
        return 'rentFrom';
    }

    if (normalizedLabel.includes('ngay tra') || normalizedLabel.includes('den ngay')) {
        return 'rentTo';
    }

    if (normalizedLabel.includes('tien coc')) {
        return 'depositAmount';
    }

    if (normalizedLabel.includes('san pham')) {
        return 'productName';
    }

    if (normalizedLabel.includes('so luong')) {
        return 'productQuantity';
    }

    if (normalizedLabel.includes('loai don')) {
        return 'orderType';
    }

    return undefined;
}

function parseNumberSafe(value: string | null, fallback: number): number {
    if (!value) {
        return fallback;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSearchText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}
