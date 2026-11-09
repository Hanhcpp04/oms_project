import { OrderStatus, OrderType, PaymentStatus } from '../../orders/data-access/models/order.model';

export interface PublicOrderTrackingItem {
  productName: string;
  productImageUrl?: string;
  sku?: string;
  size?: string;
  color?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PublicOrderTrackingPayment {
  paymentId?: number;
  provider?: string;
  method?: string;
  purpose?: string;
  status?: string;
  providerOrderCode?: number;
  providerPaymentLinkId?: string;
  amount?: number;
  currency?: string;
  description?: string;
  checkoutUrl?: string;
  qrCode?: string;
  qrImageUrl?: string;
}

export interface PublicOrderTrackingOrder {
  orderCode: string;
  orderType: OrderType;
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: 'COD' | 'BANK_TRANSFER' | 'VNPAY';
  shopName?: string;
  shopLogoUrl?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerNote?: string;
  shippingMethod?: string;
  shippingFee: number;
  totalAmount: number;
  depositAmount?: number;
  rentFrom?: string;
  rentTo?: string;
  createdAt?: string;
  updatedAt?: string;
  items: PublicOrderTrackingItem[];
  payment?: PublicOrderTrackingPayment;
}
