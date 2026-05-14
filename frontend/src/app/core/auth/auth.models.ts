export type AppRole = 'SHOP_OWNER' | 'STAFF';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: AppRole;
  forceChangePassword?: boolean;
}

export interface AuthShop {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string;
  email?: string;
  phone?: string;
  supportEmail?: string;
  supportPhone?: string;
  businessMode?: string;
  status: string;
  enableSell: boolean;
  enableRent: boolean;
  maintenanceMode: boolean;
  autoAcceptOrders: boolean;
  showInventoryOnStorefront: boolean;
  notificationsEnabled: boolean;
  rentalIdentityVerificationEnabled: boolean;
  categories?: string[];
  addresses?: ShopAddress[];
}

export interface ShopAddress {
  id?: string | number;
  label: string;
  addressLine: string;
  ward?: string;
  district?: string;
  province?: string;
  isDefault: boolean;
}

export interface AuthOnboarding {
  completed: boolean;
  currentStep: string;
}

export interface AuthSession {
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  user: AuthUser;
  shop: AuthShop | null;
  onboarding: AuthOnboarding | null;
}

export interface LoginCredentials {
  identifier: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}

export interface GoogleAuthPayload {
  idToken: string;
}
