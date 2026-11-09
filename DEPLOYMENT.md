# 🚀 Hướng Dẫn Triển Khai Hệ Thống OMS (Production Deployment Guide)

Hồ sơ tài liệu này hướng dẫn cách đưa ứng dụng OMS từ môi trường phát triển (Development) lên môi trường vận hành thực tế (Production) sử dụng Docker, Docker Compose, Nginx và Let's Encrypt SSL.

---

## 📋 Mục lục
1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Cấu hình biến môi trường (`.env`)](#2-cấu-hình-biến-môi-trường-env)
3. [Kiến trúc triển khai Production](#3-kiến-trúc-triển-khai-production)
4. [Hướng dẫn cài đặt & Chạy ứng dụng](#4-hướng-dẫn-cài-đặt--chạy-ứng-dụng)
5. [Cấu hình HTTPS với SSL Let's Encrypt](#5-cấu-hình-https-với-ssl-lets-encrypt)
6. [Quản lý & Bảo trì (Backup, Logs, Storage)](#6-quản-lý--bảo-trì-backup-logs-storage)

---

## 1. Yêu cầu hệ thống
* **Hệ điều hành:** Linux (Ubuntu 22.04 LTS hoặc mới hơn được khuyên dùng).
* **Công cụ cài sẵn:**
  * Docker (v24.0.0+)
  * Docker Compose (v2.0.0+)
* **Tên miền:** Đã đăng ký tên miền (VD: `oms.yourdomain.com`) và trỏ bản ghi A về địa chỉ IP của máy chủ VPS/Cloud.
* **Cấu hình tối thiểu:** 2 vCPU, 4GB RAM, 40GB SSD.

---

## 2. Cấu hình biến môi trường (`.env`)
Sao chép tệp tin cấu hình mẫu tại thư mục gốc của dự án:
```bash
cp .env.example .env
```

Mở tệp `.env` vừa tạo và điền các thông tin bảo mật:
1. **Database:** Thay đổi `MYSQL_ROOT_PASSWORD`, `DB_USERNAME` và `DB_PASSWORD`. Docker Compose sẽ tạo application user từ hai biến `DB_USERNAME`/`DB_PASSWORD`.
2. **Security:** Tạo mã bí mật `JWT_SECRET` ngẫu nhiên và bảo mật bằng lệnh sau:
   ```bash
   openssl rand -base64 32
   ```
3. **CORS & Domain:** Đổi `PUBLIC_FRONTEND_BASE_URL` và `CORS_ORIGINS` thành địa chỉ tên miền chính thức của bạn (VD: `https://oms.yourdomain.com`).
4. **API Keys:** Nhập API Key của Gemini AI, Google Client ID, PayOS, và các token của Facebook Messenger Page.

Trong lần khởi tạo database đầu tiên, giữ `HIBERNATE_DDL_AUTO=update` để Hibernate tạo schema. Sau khi schema đã ổn định, đổi giá trị thành `validate` và quản lý các thay đổi schema bằng migration trước mỗi lần triển khai.

---

## 3. Kiến trúc triển khai Production

Hệ thống hoạt động theo mô hình container hóa khép kín:
```mermaid
graph TD
    User([Người dùng / Webhooks]) <-->|HTTPS:443| NginxHost[Host Nginx / Reverse Proxy]
    NginxHost <-->|HTTP:80| FrontendContainer[oms-frontend Container]
    NginxHost -->|Proxy /api| BackendContainer[oms-backend Container]
    BackendContainer <--> MySQL[(oms-mysql Container)]
    
    subgraph Persistent Storage (Volumes)
        mysql_data[(MySQL Data)] <--> MySQL
        oms_uploads[(File Uploads)] <--> BackendContainer
        oms_logs[(App Logs)] <--> BackendContainer
    end
```

---

## 4. Hướng dẫn cài đặt & Chạy ứng dụng

### Bước 1: Build và khởi chạy các container
Chạy lệnh bên dưới tại thư mục gốc (nơi chứa tệp `docker-compose.yml`):
```bash
docker compose up -d --build
```
Lệnh này sẽ tải các base image, biên dịch mã nguồn Angular & Spring Boot ở dạng tối ưu hóa cho Production, sau đó chạy ngầm dưới nền.

### Bước 2: Kiểm tra trạng thái hoạt động
```bash
docker compose ps
```
Nếu tất cả dịch vụ ở trạng thái `running` (và `mysql` ở trạng thái `healthy`), kiểm tra thêm backend và frontend:

```bash
curl --fail http://127.0.0.1:8080/v3/api-docs > /dev/null
curl --fail http://127.0.0.1:4200/ > /dev/null
```

---

## 5. Cấu hình HTTPS với SSL Let's Encrypt

Để đưa sản phẩm hoạt động thực tế, việc cài đặt chứng chỉ SSL (HTTPS) là bắt buộc (đặc biệt đối với Facebook Webhooks và Google Login). Cách tốt nhất là sử dụng một Nginx cài đặt trực tiếp trên máy chủ Host đóng vai trò làm Reverse Proxy và quản lý chứng chỉ SSL.

### Bước 1: Cài đặt Nginx và Certbot trên Host
Trên hệ điều hành Ubuntu/Debian:
```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y
```

### Bước 2: Tạo cấu hình Nginx Reverse Proxy
Tạo tệp cấu hình mới:
```bash
sudo nano /etc/nginx/sites-available/oms
```

Thêm nội dung cấu hình sau (thay đổi `oms.yourdomain.com` thành tên miền của bạn):
```nginx
server {
    listen 80;
    server_name oms.yourdomain.com;

    location / {
        # Định tuyến toàn bộ lưu lượng đến container frontend (đang chạy trên cổng 4200 của host)
        proxy_pass http://127.0.0.1:4200;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Kích hoạt cấu hình và khởi động lại Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/oms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Bước 3: Đăng ký chứng chỉ SSL miễn phí Let's Encrypt
Chạy Certbot để tự động đăng ký và cài đặt SSL:
```bash
sudo certbot --nginx -d oms.yourdomain.com
```
Làm theo các bước hướng dẫn trên màn hình. Chọn cấu hình **Redirect** để tự động chuyển hướng mọi truy cập HTTP sang HTTPS.

---

## 6. Quản lý & Bảo trì (Backup, Logs, Storage)

### 6.1 Quản lý Tệp Tin Đã Tải Lên (Uploads)
Toàn bộ tệp tin do người dùng tải lên được lưu bên ngoài container thông qua volume `oms_uploads`. Xác định chính xác thư mục trên host bằng:

```bash
docker volume inspect "$(docker volume ls --filter name=oms_uploads -q | head -n 1)"
```

Bạn nên lập lịch sao lưu (backup) định kỳ thư mục này.

### 6.2 Quản lý Nhật Ký Hoạt Động (Logs)
Chúng tôi đã tích hợp cơ chế tự động xoay vòng logs (Log Rotation) vào ứng dụng backend. Tệp logs sẽ tự động được chia nhỏ khi đạt kích thước `10MB` và chỉ lưu trữ tối đa trong `30 ngày`.
* Xem logs trực tiếp từ Docker:
  ```bash
    docker compose logs -f backend
  ```
* Xác định volume logs bằng `docker volume ls --filter name=oms_logs` và `docker volume inspect`.

### 6.3 Lập lịch Sao Lưu Cơ Sở Dữ Liệu MySQL (Backup DB)
Để sao lưu dữ liệu tự động, bạn có thể tạo một script nhỏ và thêm vào `cronjob`:
```bash
# Lệnh export thủ công database:
docker compose exec -T mysql mysqldump -u root -p'MAT_KHAU_CUA_BAN' oms_db > backup_db_$(date +%F).sql
```
Lập lịch chạy lệnh này mỗi ngày một lần vào lúc 0:00 sáng để đảm bảo an toàn dữ liệu.
