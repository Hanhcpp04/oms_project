export type OrderStatus =
  | 'PENDING'
  | 'NEW'
  | 'CONFIRMED'
  | 'PACKING'
  | 'SHIPPED'
  | 'DONE'
  | 'CANCELLED'
  | 'DEPOSITED'
  | 'PAID'
  | 'RENTING'
  | 'OVERDUE'
  | 'RETURNED';
export type OrderType = 'RENT' | 'SELL';
export type PaymentStatus = 'UNPAID' | 'DEPOSITED' | 'PAID';

export interface OrderProduct {
  id?: string | number;
  variantId?: string | number;
  productId?: string | number;
  productNameSnapshot?: string;
  productImageSnapshot?: string;
  categoryNameSnapshot?: string;
  skuSnapshot?: string;
  variantSizeSnapshot?: string;
  variantColorSnapshot?: string;
  name?: string; // fallback
  size?: string; // fallback
  quantity: number;
  unitPrice: number;
  lineTotal?: number;
}

export interface OrderCustomFieldValue {
  id?: string | number;
  fieldId?: string | number | null;
  fieldKeySnapshot: string;
  labelSnapshot: string;
  formTypeSnapshot: string;
  valueJson: string;
  showInListSnapshot?: boolean;
  showInDetailSnapshot?: boolean;
  sortOrderSnapshot?: number;
}

export type FulfillmentStatus =
  | 'PENDING_CONFIRMATION'
  | 'READY_TO_PACK'
  | 'READY_TO_RENT'
  | 'PACKING'
  | 'SHIPPED'
  | 'DONE'
  | 'CANCELLED'
  | 'DEPOSITED'
  | 'RENTING'
  | 'OVERDUE'
  | 'RETURNED'
  | 'PAID';

export interface Order {
  id: string;
  orderCode: string;
  orderNumber?: string;
  orderType: OrderType;
  source?: string;
  sourceMethod?: 'MANUAL' | 'AI_PARSE' | 'PUBLIC_FORM' | 'MESSENGER';
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  createdAt: string;
  updatedAt?: string;
  status: OrderStatus;
  fulfillmentStatus?: FulfillmentStatus;
  paymentStatus?: PaymentStatus;
  totalAmount: number;
  depositAmount?: number;
  sourceChannel?: string;
  shippingMethod?: string;
  shippingFee?: number;
  products: OrderProduct[];
  customerNote: string;
  createdByFullName?: string;
  createdByUsername?: string;
  customFields?: Record<string, unknown>;
  customFieldValues?: OrderCustomFieldValue[];
  paymentMethod?: 'COD' | 'BANK_TRANSFER' | 'VNPAY';
  // Rental-specific fields
  rentFrom?: string;
  rentTo?: string;
  depositPaid?: number;
  returnStatus?: string;
  returnedAt?: string;
  messenger?: {
    pageId?: string;
    customerPsid?: string;
    conversationId?: string | number;
    draftId?: string | number;
  };
}

export interface OrdersQuery {
  page: number;
  size: number;
  search?: string;
  status?: OrderStatus;
  orderType?: OrderType;
  fromDate?: string;
  toDate?: string;
}

export interface CreateOrderProductInput {
  variantId?: string | number;
  name: string;
  size: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateOrderInput {
  orderType: OrderType;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerNote: string;
  sourceChannel?: string;
  shippingMethod?: string;
  shippingFee?: number;
  products: CreateOrderProductInput[];
  customFields?: Record<string, unknown>;
  customFieldValues?: OrderCustomFieldValue[]; // For v3 backend
  sourceMethod?: 'MANUAL' | 'AI_PARSE' | 'PUBLIC_FORM' | 'MESSENGER';
  paymentMethod?: 'COD' | 'BANK_TRANSFER' | 'VNPAY';
  rentFrom?: string;
  rentTo?: string;
  depositPaid?: number;
  shippingMethodId?: number;
  sourceChannelId?: number;
}

export interface UpdateOrderInput {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerNote: string;
  sourceChannel?: string;
  shippingMethod?: string;
  shippingFee?: number;
  paymentStatus?: PaymentStatus;
  paymentMethod?: 'COD' | 'BANK_TRANSFER' | 'VNPAY';
}

export interface AutoOrderDraft {
  orderType?: OrderType;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerNote?: string;
  sourceChannel?: string;
  shippingMethod?: string;
  shippingFee?: number;
  products?: CreateOrderProductInput[];
  customFields?: Record<string, unknown>;
  rentFrom?: string;
  rentTo?: string;
  depositPaid?: number;
}
