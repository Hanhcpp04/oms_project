# OMS — Order Management System

Hệ thống quản lý đơn hàng đa kênh dành cho shop bán và cho thuê sản phẩm. OMS tập trung dữ liệu sản phẩm, tồn kho, đơn hàng, nhân viên và hội thoại Facebook Messenger trong một ứng dụng web.

## Chức năng chính

- Đăng ký, đăng nhập, Google Sign-In và JWT access/refresh token.
- Onboarding và cấu hình thông tin vận hành của shop.
- Quản lý sản phẩm, biến thể, tồn kho, QR code và sản phẩm cho thuê.
- Tạo, cập nhật và theo dõi trạng thái đơn bán hoặc đơn thuê.
- Kiểm tra lịch trống của sản phẩm cho thuê.
- Quản lý nhân viên, ca làm việc, role và permission.
- Cấu hình biểu mẫu sản phẩm/đơn hàng và public order form.
- Nhận hội thoại Facebook Messenger, trích xuất thông tin đơn hàng bằng rule/Gemini và tạo order draft.
- Thanh toán qua payOS, thông báo realtime bằng SSE và dashboard báo cáo.

## Tech stack

| Layer | Technology |
| --- | --- |
| Backend | Java 17, Spring Boot 3.4, Spring Security, JPA/Hibernate, Blaze-Persistence |
| Frontend | Angular 20.3, TypeScript 5.9, Signals, Tailwind CSS 4 |
| Database | MySQL 8.0 |
| Authentication | JWT access/refresh token, Google Sign-In |
| Integration | Facebook Messenger, Gemini, payOS |
| Deployment | Docker, Docker Compose, Nginx |

## Cấu trúc project

```text
oms-project/
├── backend/                 # Spring Boot REST API
├── frontend/                # Angular SPA
├── docs/                    # Tài liệu thiết kế frontend
├── .env.example             # Mẫu biến môi trường
├── docker-compose.yml       # MySQL + backend + frontend
├── DEPLOYMENT.md            # Hướng dẫn production
└── README.md
```

## Chạy local

### Yêu cầu

- Java 17+
- Maven 3.9+
- Node.js 20+
- MySQL 8.0 hoặc Docker

### 1. Cấu hình môi trường

Sao chép file mẫu ở thư mục gốc:

```bash
cp .env.example .env
```

Tối thiểu cần cấu hình:

```dotenv
DB_USERNAME=oms_user
DB_PASSWORD=your_password
JWT_SECRET=your_base64_secret
```

Tạo JWT secret bằng:

```bash
openssl rand -base64 32
```

### 2. Khởi động MySQL

```bash
docker compose up -d mysql
```

Hoặc dùng MySQL local và tạo database/user tương ứng với `.env`.

### 3. Chạy backend

Từ thư mục gốc để backend đọc được `.env`:

```bash
mvn -f backend/pom.xml spring-boot:run
```

- API: `http://localhost:8080`
- Swagger UI: `http://localhost:8080/swagger-ui.html`

### 4. Chạy frontend

```bash
cd frontend
npm install
npm start
```

Ứng dụng chạy tại `http://localhost:4200`; Angular dev server proxy `/api` sang backend.

## Chạy toàn bộ bằng Docker

```bash
docker compose up -d --build
```

- Frontend: `http://localhost:4200`
- Backend: `http://localhost:8080`
- MySQL: `localhost:3306`

Lần khởi tạo database đầu tiên, `.env.example` đặt `HIBERNATE_DDL_AUTO=update`. Sau khi schema đã được tạo và ổn định, nên đổi thành `validate`.

## Biến môi trường tích hợp

| Nhóm | Biến chính |
| --- | --- |
| Database | `MYSQL_ROOT_PASSWORD`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `DB_PORT` |
| Security | `JWT_SECRET`, `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION` |
| Google | `GOOGLE_CLIENT_ID` |
| Gemini | `GEMINI_API_KEY` |
| Messenger | `MESSENGER_VERIFY_TOKEN`, `MESSENGER_PAGE_ID`, `MESSENGER_PAGE_ACCESS_TOKEN`, `MESSENGER_DEFAULT_SHOP_ID` |
| payOS | `PAYOS_ENABLED`, `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` |
| Public URL | `PUBLIC_FRONTEND_BASE_URL`, `PUBLIC_ORDER_TRACKING_SECRET`, `CORS_ORIGINS` |

Xem đầy đủ tại [.env.example](.env.example).

## Kiểm tra chất lượng

```bash
# Backend
mvn -f backend/pom.xml test

# Frontend build
cd frontend
npm run build

# Frontend unit test
npm test -- --watch=false
```

## API chính

| Module | Base path |
| --- | --- |
| Authentication | `/api/auth` |
| Shop/onboarding | `/api/shops` |
| Products | `/api/products` |
| Orders | `/api/orders` |
| Rental availability | `/api/rental/availability` |
| Staff/permissions | `/api/staff`, `/api/permissions` |
| Forms | `/api/form-templates`, `/api/order-form-configs`, `/api/product-form-configs` |
| Messenger staff APIs | `/api/staff/conversations`, `/api/staff/order-drafts` |
| Payments | `/api/payments` |
| Notifications | `/api/notifications` |
| Reports | `/api/reports` |

Chi tiết triển khai production nằm trong [DEPLOYMENT.md](DEPLOYMENT.md).

## License

Private — Internal use only.
