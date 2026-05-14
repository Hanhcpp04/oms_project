import { CreateOrderInput } from '../data-access/models/order.model';

export function normalizeCreateOrderInput(input: CreateOrderInput): CreateOrderInput {
    return {
        orderType: input.orderType,
        customerName: input.customerName.trim(),
        customerPhone: input.customerPhone.trim(),
        customerAddress: input.customerAddress.trim(),
        customerNote: input.customerNote ? input.customerNote.trim() : '',
        sourceChannel: input.sourceChannel?.trim(),
        shippingMethod: input.shippingMethod?.trim(),
        shippingFee: typeof input.shippingFee === 'number' && Number.isFinite(input.shippingFee)
            ? Math.max(0, Math.round(input.shippingFee))
            : undefined,
        products: input.products
            .map((item) => ({
                name: item.name.trim() || 'Sản phẩm chưa đặt tên',
                size: item.size.trim() || 'Free',
                quantity: Math.max(1, Math.round(item.quantity || 1)),
                unitPrice: Math.max(0, Math.round(item.unitPrice || 0))
            }))
            .filter((item) => item.name.length > 0),
        customFieldValues: input.customFieldValues,
        sourceMethod: input.sourceMethod,
        rentFrom: input.rentFrom,
        rentTo: input.rentTo,
        depositPaid:
            typeof input.depositPaid === 'number' && Number.isFinite(input.depositPaid)
                ? Math.max(0, Math.round(input.depositPaid))
                : undefined
    };
}

export function generateLocalId(): string {
    return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateOrderNumber(): string {
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const randomPart = Math.floor(100 + Math.random() * 900);
    return `ORD-${datePart}-${randomPart}`;
}

export function formatDisplayDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}
