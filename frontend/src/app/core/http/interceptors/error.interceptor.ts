import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../../services/notification.service';
import { API_CONFIG } from '../api.config';

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const notificationService = inject(NotificationService);
  const apiConfig = inject(API_CONFIG);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        // Only show toast for OMS backend API calls (matching the configured base URL)
        // External APIs (e.g. provinces API, Google) are handled locally by the caller
        const isOmsApi = request.url.startsWith(apiConfig.baseUrl);
        if (isOmsApi) {
          notificationService.error(resolveErrorMessage(error));
        }
      }

      return throwError(() => error);
    })
  );
};

function resolveErrorMessage(error: HttpErrorResponse): string {
  if (typeof error.error === 'string' && error.error.trim().length > 0) {
    return translateBackendMessage(error.error);
  }

  if (isRecord(error.error) && typeof error.error['message'] === 'string') {
    return translateBackendMessage(error.error['message']);
  }

  if (error.status === 0) {
    return 'Không thể kết nối đến máy chủ OMS. Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.';
  }

  if (error.status === 401) {
    return 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
  }

  if (error.status === 403) {
    return 'Bạn không có quyền thực hiện thao tác này.';
  }

  if (error.status === 404) {
    return 'Không tìm thấy tài nguyên yêu cầu.';
  }

  if (error.status === 422) {
    return 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin.';
  }

  if (error.status >= 500) {
    return 'Lỗi hệ thống. Vui lòng thử lại hoặc liên hệ hỗ trợ.';
  }

  return `Yêu cầu thất bại (mã lỗi: ${error.status}).`;
}

const BACKEND_MESSAGE_MAP: Record<string, string> = {
  'shop is currently in maintenance mode': 'Shop đang bảo trì. Vui lòng quay lại sau.',
  'shop is not active': 'Shop hiện không hoạt động.',
  'shop not found': 'Không tìm thấy cửa hàng.',
  'product not found': 'Không tìm thấy sản phẩm.',
  'unauthorized': 'Bạn chưa đăng nhập hoặc phiên đã hết hạn.',
  'forbidden': 'Bạn không có quyền thực hiện thao tác này.',
  'order not found': 'Không tìm thấy đơn hàng.',
  'invalid phone number': 'Số điện thoại không hợp lệ.',
  'invalid email': 'Email không hợp lệ.',
  'variant not found': 'Không tìm thấy biến thể sản phẩm.',
  'out of stock': 'Sản phẩm đã hết hàng.',
  'insufficient stock': 'Không đủ số lượng tồn kho.',
  'username already exists': 'Tên đăng nhập đã tồn tại.',
  'email already exists': 'Email đã được sử dụng.',
  'phone already exists': 'Số điện thoại đã được sử dụng.',
  'duplicate entry': 'Dữ liệu bị trùng lặp.',
  'bad request': 'Yêu cầu không hợp lệ.',
  'internal server error': 'Lỗi hệ thống. Vui lòng thử lại sau.',
  'access denied': 'Truy cập bị từ chối.',
  'not found': 'Không tìm thấy dữ liệu yêu cầu.',
  'validation failed': 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.',
  'file too large': 'Tệp tải lên quá lớn.',
  'invalid file type': 'Loại tệp không được hỗ trợ.',
  'category not found': 'Không tìm thấy danh mục.',
  'user not found': 'Không tìm thấy người dùng.',
  'shift conflict': 'Ca làm việc bị trùng lịch.',
  'address not found': 'Không tìm thấy địa chỉ.',
};

function translateBackendMessage(message: string): string {
  const lower = message.trim().toLowerCase();

  // Exact match
  if (BACKEND_MESSAGE_MAP[lower]) {
    return BACKEND_MESSAGE_MAP[lower];
  }

  // Partial match (e.g. "Product not found with id 5")
  for (const [key, val] of Object.entries(BACKEND_MESSAGE_MAP)) {
    if (lower.includes(key)) {
      return val;
    }
  }

  return message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
