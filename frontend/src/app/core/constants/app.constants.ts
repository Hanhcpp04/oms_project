export const APP_NAME = 'OMS';

export const STORAGE_KEYS = {
  accessToken: 'oms_access_token',
  refreshToken: 'oms_refresh_token',
  authSession: 'oms_auth_session',
  formTemplates: 'oms_form_templates',
  productFormTemplates: 'oms_product_form_templates'
} as const;

export const API_ENDPOINTS = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    google: '/auth/google',
    me: '/auth/me',
    refresh: '/auth/refresh',
    logout: '/auth/logout'
  },
  dashboard: '/dashboard',
  formTemplates: '/form-templates',
  productFormTemplates: '/product-form-configs',
  orderFormTemplates: '/order-form-configs',
  publicForms: '/public/forms',
  orders: '/orders',
  orderAutoClean: '/orders/ai-parse',
  products: '/products',
  users: '/staff',
  sla: '/sla'
} as const;
