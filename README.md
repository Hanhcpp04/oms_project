# 🛒 OMS — Order Management System

> Hệ thống Quản lý Đơn hàng Đa kênh từ Mạng xã hội

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Java 17, Spring Boot 3.4, JPA/Hibernate, Blaze-Persistence |
| **Frontend** | Angular 21, TypeScript, Tailwind CSS, Signals |
| **Database** | MySQL 8.0 |
| **Auth** | JWT (Access + Refresh Token) |
| **DevOps** | Docker, Docker Compose |

## Project Structure

```
oms-project/
├── backend/          ← Spring Boot REST API
├── frontend/         ← Angular SPA
├── docs/             ← Project documentation
│   ├── coding-rules.md
│   ├── skills.md
│   └── project-features.md
├── docker-compose.yml
├── .gitignore
└── README.md
```

## Quick Start

### Prerequisites
- Java 17+
- Node.js 20+
- MySQL 8.0+
- Maven 3.9+

### 1. Database Setup
```bash
# Option A: Docker
docker-compose up -d mysql

# Option B: Local MySQL
mysql -u root -p -e "CREATE DATABASE oms_db CHARACTER SET utf8mb4;"
```

### 2. Backend
```bash
cd backend
mvn spring-boot:run
# API: http://localhost:8080
# Swagger: http://localhost:8080/swagger-ui.html
```

### 3. Frontend
```bash
cd frontend
npm install
ng serve
# App: http://localhost:4200
```

### 4. Docker (Full Stack)
```bash
docker-compose up --build
```

## Documentation

| Document | Description |
|----------|------------|
| [Coding Rules](docs/coding-rules.md) | Quy tắc coding & conventions |
| [Skills](docs/skills.md) | Kỹ năng cần thiết & onboarding |
| [Project Features](docs/project-features.md) | Mô tả 12 use cases chi tiết |

## API Endpoints Overview

| Module | Endpoint | Description |
|--------|----------|------------|
| Auth | `POST /api/auth/login` | Đăng nhập |
| Auth | `POST /api/auth/register` | Đăng ký shop |
| Products | `GET/POST /api/products` | Quản lý sản phẩm |
| Orders | `GET/POST /api/orders` | Quản lý đơn hàng |
| Orders | `PATCH /api/orders/:id/status` | Cập nhật trạng thái |
| Notifications | `GET /api/notifications` | Thông báo |

## License

Private — Internal use only.
