import { UserRole } from '../models/user-account.model';

export const USER_ROLE_OPTIONS: ReadonlyArray<{ label: string; value: UserRole }> = [
  { label: 'Staff', value: 'STAFF' },
  { label: 'Admin', value: 'ADMIN' },
  { label: 'Operator', value: 'OPERATOR' },
  { label: 'Viewer', value: 'VIEWER' }
];