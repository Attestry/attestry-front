import { ROLES } from '../store/useAuthStore';

export const getRoleLandingPath = (role) => {
  switch (role) {
    case ROLES.BRAND:
      return '/brand/products';
    case ROLES.RETAIL:
      return '/retail/inventory';
    case ROLES.SERVICE:
      return '/service/requests';
    case ROLES.PLATFORM_ADMIN:
      return '/admin/onboarding';
    case ROLES.USER:
    default:
      return '/';
  }
};
