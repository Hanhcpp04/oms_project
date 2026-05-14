import { AppRole } from '../../core/auth/auth.models';
import { ShopSetupStepKey } from '../../core/services/shop-setup-status.service';

export interface LayoutNavItem {
  label: string;
  route?: string;
  icon: string;
  children?: LayoutNavChildItem[];
  allowedRoles?: AppRole[];
  setupStepKeys?: ShopSetupStepKey[];
}

export interface LayoutNavChildItem {
  label: string;
  route: string;
  allowedRoles?: AppRole[];
  setupStepKeys?: ShopSetupStepKey[];
}
