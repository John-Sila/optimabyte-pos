export const RIGHTS = {
  DASHBOARD: 'dashboard_access',
  SALES: 'sales_access',
  INVENTORY: 'inventory_access',
  PRODUCTION: 'production_access',
  USERS: 'users_access',
  ANALYTICS: 'analytics_access',
  FILTRATION: 'filter_access'
} as const;

export type Right = typeof RIGHTS[keyof typeof RIGHTS];