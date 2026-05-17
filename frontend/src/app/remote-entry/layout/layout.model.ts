import { AppRole } from '../../core/auth/auth.models';
import { PermissionCode } from '../../core/services/permission.service';
import { ShopSetupStepKey } from '../../core/services/shop-setup-status.service';

export interface LayoutNavItem {
  label: string;
  route?: string;
  icon: string;
  children?: LayoutNavChildItem[];
  allowedRoles?: AppRole[];
  requiredPermissions?: PermissionCode[];
  setupStepKeys?: ShopSetupStepKey[];
  businessMode?: 'SELL' | 'RENT';
}

export interface LayoutNavChildItem {
  label: string;
  route: string;
  allowedRoles?: AppRole[];
  requiredPermissions?: PermissionCode[];
  setupStepKeys?: ShopSetupStepKey[];
  businessMode?: 'SELL' | 'RENT';
}
