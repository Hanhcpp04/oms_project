# OMS Frontend

Angular 20.3 SPA cho hệ thống OMS. Frontend dùng standalone components, Signals, functional guards/interceptors và Tailwind CSS 4.

## Chạy development

```bash
npm install
npm start
```

Ứng dụng chạy tại `http://localhost:4200`. Cấu hình trong `proxy.conf.json` chuyển `/api` đến backend tại `http://localhost:8080`.

Google Client ID được đọc từ `frontend/.env` khi chạy local:

```dotenv
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

Script `scripts/generate-runtime-env.mjs` sinh `public/env.js` trước lệnh `start` và `build`. Khi chạy Docker, `entrypoint.sh` sinh lại file này từ biến môi trường của container.

## Commands

```bash
npm start                       # Development server
npm run build                   # Production build
npm run watch                   # Development build dạng watch
npm test -- --watch=false       # Unit tests
```

Project hiện chưa cấu hình e2e test runner.

## Cấu trúc chính

```text
src/app/
├── core/           # Auth, HTTP, guards, services và models dùng toàn app
├── features/       # Các business feature
├── remote-entry/   # Main layout, header và sidebar
└── shared/         # UI components, directives, validators và utilities
```
