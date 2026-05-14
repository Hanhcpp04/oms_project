import { OrderStatus } from '../models/order.model';

export const ORDER_STATUS_OPTIONS: ReadonlyArray<{ label: string; value: OrderStatus }> = [
  { label: 'Chờ duyệt', value: 'PENDING' },
  { label: 'Mới', value: 'NEW' },
  { label: 'Đã xác nhận', value: 'CONFIRMED' },
  { label: 'Đang đóng gói', value: 'PACKING' },
  { label: 'Đã giao hàng', value: 'SHIPPED' },
  { label: 'Hoàn thành', value: 'DONE' },
  { label: 'Đã hủy', value: 'CANCELLED' },
  { label: 'Đã cọc', value: 'DEPOSITED' },
  { label: 'Đã thanh toán', value: 'PAID' },
  { label: 'Đang thuê', value: 'RENTING' },
  { label: 'Quá hạn', value: 'OVERDUE' },
  { label: 'Đã trả hàng', value: 'RETURNED' }
];