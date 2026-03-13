import { create } from 'zustand';
import { apiFetchJson } from '../utils/api';
import { normalizeApiErrorMessage } from '../utils/permissionUi';
import { setAuthNotice } from '../utils/authSession';

// Roles definition
export const ROLES = {
  USER: 'USER',
  BRAND: 'BRAND',
  RETAIL: 'RETAIL',
  SERVICE: 'SERVICE',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
};

export const TENANT_ROLES = {
  ADMIN: 'TENANT_OWNER',
  OPERATOR: 'TENANT_OPERATOR',
  STAFF: 'TENANT_STAFF',
};

export const ROLE_THEMES = {
  [ROLES.USER]: { name: '일반 회원', primary: '#111827', border: '#e5e7eb', bg: '#f9fafb' },
  [ROLES.BRAND]: { name: '브랜드(Brand)', primary: '#2856D8', border: '#C9D6FB', bg: '#F5F8FF' },
  [ROLES.RETAIL]: { name: '리테일(Retail)', primary: '#4D8B6A', border: '#CFE6D9', bg: '#F5FBF7' },
  [ROLES.SERVICE]: { name: '서비스(Service)', primary: '#C27A2C', border: '#F1D5B6', bg: '#FFF8F1' },
  [ROLES.PLATFORM_ADMIN]: { name: '플랫폼 관리자', primary: '#9333ea', border: '#e9d5ff', bg: '#faf5ff' },
};

// API Helper
const apiFetch = async (url, options = {}) => {
  const token = useAuthStore.getState().accessToken;
  return apiFetchJson(url, options, { token, fallbackMessage: normalizeApiErrorMessage('', undefined) });
};

const isAdminEmail = (email) => String(email || '').toLowerCase().includes('admin');

const membershipRoleOf = (membership) => {
  const groupType = String(membership?.groupType || '').toUpperCase();
  return ROLES[groupType] || null;
};

const pickPreferredMembership = (memberships, preferredTenantId, preferredRole) => {
  const allMemberships = memberships || [];
  const activeMemberships = allMemberships.filter((membership) => String(membership?.status).toUpperCase() === 'ACTIVE');
  const candidates = activeMemberships.length ? activeMemberships : allMemberships;

  return candidates.find((membership) => membership?.tenantId === preferredTenantId)
    || candidates.find((membership) => membershipRoleOf(membership) === preferredRole)
    || candidates[0]
    || null;
};

const isCurrentUsersMembership = (memberships, membershipId) =>
  (memberships || []).some((membership) => membership?.membershipId === membershipId);

const logoutWithNotice = (setToken, message) => {
  setAuthNotice(message);
  setToken(null);
};

const useAuthStore = create((set, get) => ({
  // --- SESSION STATE ---
  user: JSON.parse(localStorage.getItem('user')) || null,
  accessToken: localStorage.getItem('accessToken') || null,
  isAuthenticated: !!localStorage.getItem('accessToken'),
  error: null,

  // --- PLATFORM & TENANT STATE ---
  platformTemplates: [],
  rootPermissions: [],
  tenantTemplates: [],
  myMemberships: [],
  tenantMemberships: [],
  roleBindings: {},
  applications: [],
  myApplications: [],
  myAccount: null,

  // Update token
  setToken: (token, user = null) => {
    if (token) {
      localStorage.setItem('accessToken', token);
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
        set({ accessToken: token, isAuthenticated: true, user });
      } else {
        set({ accessToken: token, isAuthenticated: true });
      }
    } else {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      set({ accessToken: null, isAuthenticated: false, user: null });
    }
  },

  // Update user context manually if needed
  setUserContext: (userContext) => {
    localStorage.setItem('user', JSON.stringify(userContext));
    set({ user: userContext });
  },

  // --- AUTH ACTIONS ---
  signup: async (email, password, phone) => {
    try {
      set({ error: null });
      await apiFetch('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, phone }),
      });
      return { success: true };
    } catch (error) {
      set({ error: error.message });
      return { success: false, message: error.message };
    }
  },

  login: async (email, password, tenantId = null) => {
    try {
      set({ error: null });
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, tenantId }),
      });

      const userContext = {
        id: data.userId,
        email,
        tenantId: data.tenantId,
        role: isAdminEmail(email) ? ROLES.PLATFORM_ADMIN : ROLES.USER,
        availableRoles: [
          ROLES.USER,
          ...(isAdminEmail(email) ? [ROLES.PLATFORM_ADMIN] : [])
        ]
      };

      // Store token and user
      get().setToken(data.accessToken, userContext);

      // Resolve the actual operating role from the user's memberships after login.
      await get().fetchMyMemberships({
        resolveRoleFromMemberships: true,
        preferredTenantId: data.tenantId ?? tenantId ?? null,
      });

      return { success: true, user: get().user || userContext };
    } catch (error) {
      set({ error: error.message });
      return { success: false, message: error.message };
    }
  },

  fetchMyMemberships: async (options = {}) => {
    try {
      const {
        resolveRoleFromMemberships = false,
        preferredTenantId = null,
      } = options;
      const memberships = await apiFetch('/me/memberships');
      const membershipRoles = (memberships || []).flatMap((m) => {
        const role = membershipRoleOf(m);
        return role ? [role] : [];
      });

      let availableRoles = [ROLES.USER, ...membershipRoles];
      if (isAdminEmail(get().user?.email)) {
        availableRoles.push(ROLES.PLATFORM_ADMIN);
      }
      availableRoles = [...new Set(availableRoles)];

      set(state => {
        const currentUser = state.user;
        if (!currentUser) return state;

        const selectedMembership = pickPreferredMembership(
          memberships,
          preferredTenantId ?? currentUser.tenantId ?? null,
          currentUser.role
        );
        const selectedMembershipRole = membershipRoleOf(selectedMembership);
        let nextRole = availableRoles.includes(currentUser.role) ? currentUser.role : ROLES.USER;

        if (resolveRoleFromMemberships) {
          nextRole = selectedMembershipRole
            || (isAdminEmail(currentUser.email) ? ROLES.PLATFORM_ADMIN : ROLES.USER);
        }

        const newUser = {
          ...currentUser,
          tenantId: nextRole === ROLES.USER || nextRole === ROLES.PLATFORM_ADMIN
            ? null
            : (selectedMembership?.tenantId ?? currentUser.tenantId ?? null),
          tenantName: nextRole === ROLES.USER || nextRole === ROLES.PLATFORM_ADMIN
            ? null
            : (selectedMembership?.tenantName ?? currentUser.tenantName ?? null),
          role: nextRole,
          availableRoles,
        };
        localStorage.setItem('user', JSON.stringify(newUser));
        return { user: newUser, myMemberships: memberships || [] };
      });
      return { success: true, data: memberships };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  logout: async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Logout API failed, forcing local logout');
    }
    get().setToken(null);
  },

  reissueToken: async (tenantId = get().user?.tenantId ?? null) => {
    try {
      const data = await apiFetch('/auth/token-reissue', { method: 'POST' });
      // Update store with new token
      get().setToken(data.accessToken, {
        ...get().user,
        tenantId: data.tenantId
      });
      // Refresh memberships to get updated scopes/roles
      await get().fetchMyMemberships();
      return { success: true, data };
    } catch (error) {
      console.error('Token reissue failed:', error.message);
      return { success: false, message: error.message };
    }
  },


  verifyPhone: async () => {
    try {
      await apiFetch('/auth/verify-phone', { method: 'POST' });
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  setRole: (newRole) => set((state) => {
    if (!state.user) return { user: null };

    const targetMembership = [ROLES.BRAND, ROLES.RETAIL, ROLES.SERVICE].includes(newRole)
      ? (state.myMemberships || []).find((m) =>
          String(m?.status).toUpperCase() === 'ACTIVE' &&
          String(m?.groupType || '').toUpperCase() === newRole
        ) || (state.myMemberships || []).find((m) => String(m?.groupType || '').toUpperCase() === newRole)
      : null;

    const nextUser = {
      ...state.user,
      role: newRole,
      tenantId: newRole === ROLES.USER || newRole === ROLES.PLATFORM_ADMIN
        ? null
        : (targetMembership?.tenantId ?? state.user.tenantId ?? null),
      tenantName: newRole === ROLES.USER || newRole === ROLES.PLATFORM_ADMIN
        ? null
        : (targetMembership?.tenantName ?? state.user.tenantName ?? null),
    };

    localStorage.setItem('user', JSON.stringify(nextUser));
    return { user: nextUser };
  }),

  switchRole: async (newRole) => {
    try {
      const { user, myMemberships } = get();
      if (!user) {
        return { success: false, message: '로그인이 필요합니다.' };
      }

      if (newRole === ROLES.USER || newRole === ROLES.PLATFORM_ADMIN) {
        get().setRole(newRole);
        return { success: true };
      }

      const targetMembership = (myMemberships || []).find((membership) =>
        String(membership?.status).toUpperCase() === 'ACTIVE' &&
        String(membership?.groupType || '').toUpperCase() === newRole
      ) || (myMemberships || []).find((membership) =>
        String(membership?.groupType || '').toUpperCase() === newRole
      );

      if (!targetMembership?.membershipId) {
        return { success: false, message: '전환할 멤버십을 찾지 못했습니다.' };
      }

      const data = await apiFetch('/auth/tenant-switch', {
        method: 'POST',
        body: JSON.stringify({ membershipId: targetMembership.membershipId }),
      });

      const nextUser = {
        ...user,
        tenantId: data.tenantId ?? targetMembership.tenantId ?? null,
        tenantName: targetMembership.tenantName ?? null,
        role: newRole,
      };

      get().setToken(data.accessToken, nextUser);
      await get().fetchMyMemberships();
      get().setRole(newRole);

      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  // --- ONBOARDING ACTIONS ---
  submitApplication: async (application) => {
    try {
      const response = await apiFetch('/onboarding/applications', {
        method: 'POST',
        body: JSON.stringify({
          type: application.type, // RETAIL, BRAND, SERVICE
          orgName: application.orgName,
          country: application.country,
          address: application.address,
          bizRegNo: application.bizRegNo,
          evidenceBundleId: application.evidenceBundleId
        })
      });
      return { success: true, data: response };
    } catch (error) {
      set({ error: error.message });
      return { success: false, message: error.message };
    }
  },

  presignEvidence: async (fileName, contentType, evidenceBundleId = null) => {
    try {
      const data = await apiFetch('/onboarding/evidences/presign', {
        method: 'POST',
        body: JSON.stringify({ evidenceBundleId, fileName, contentType })
      });
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  completeEvidenceUpload: async (evidenceBundleId, evidenceFileId, sizeBytes) => {
    try {
      const data = await apiFetch('/onboarding/evidences/complete', {
        method: 'POST',
        body: JSON.stringify({ evidenceBundleId, evidenceFileId, sizeBytes })
      });
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  // --- ACCOUNT ACTIONS ---
  fetchMyAccount: async () => {
    try {
      const data = await apiFetch('/me/account');
      set({ myAccount: data });
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  updateMyAccount: async (command) => {
    try {
      const data = await apiFetch('/me/account', {
        method: 'PATCH',
        body: JSON.stringify(command)
      });
      set({ myAccount: data });
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  // Admin APIs for onboarding
  listMyApplications: async () => {
    try {
      const data = await apiFetch(`/onboarding/applications/me`);
      set({ myApplications: data || [] });
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  getApplication: async (applicationId) => {
    try {
      const data = await apiFetch(`/onboarding/applications/me/${applicationId}`);
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  listApplications: async (type = '') => {
    try {
      const query = type ? `?type=${type}` : '';
      const data = await apiFetch(`/onboarding/applications${query}`);
      set({ applications: data || [] });
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  getAdminApplication: async (applicationId) => {
    try {
      const data = await apiFetch(`/onboarding/applications/${applicationId}`);
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  approveApplication: async (applicationId) => {
    try {
      await apiFetch(`/onboarding/applications/${applicationId}/approve`, { method: 'POST' });
      // Refresh local list
      await get().listApplications();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  rejectApplication: async (applicationId, rejectReason) => {
    try {
      await apiFetch(`/onboarding/applications/${applicationId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason })
      });
      await get().listApplications();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  // --- MEMBERSHIP ADMIN ACTIONS (Matches membership-admin.http) ---
  acceptInvitation: async (invitationId) => {
    try {
      const data = await apiFetch(`/invitations/${invitationId}/accept`, { method: 'POST' });
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  listMemberships: async () => {
    try {
      const { user } = get();
      if (!user?.tenantId) return { success: false };
      const data = await apiFetch(`/memberships`);
      set({ tenantMemberships: data || [] });
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  getMembershipDetail: async (membershipId) => {
    try {
      const data = await apiFetch(`/memberships/${membershipId}`);
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  inviteMember: async (email, roleCode) => {
    try {
      const { user } = get();
      if (!user?.tenantId) return { success: false };

      // Map roleCode (TENANT_OWNER etc.) back to invitation enum (ADMIN, OPERATOR, STAFF)
      let inviteRole = 'STAFF';
      if (roleCode === TENANT_ROLES.ADMIN) inviteRole = 'ADMIN';
      else if (roleCode === TENANT_ROLES.OPERATOR) inviteRole = 'OPERATOR';

      const data = await apiFetch(`/invitations`, {
        method: 'POST',
        body: JSON.stringify({ email, role: inviteRole })
      });
      await get().listMemberships();
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  updateMembershipStatus: async (membershipId, status) => {
    try {
      const shouldReissue = isCurrentUsersMembership(get().myMemberships, membershipId);
      await apiFetch(`/memberships/${membershipId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      if (shouldReissue) {
        logoutWithNotice(
          get().setToken,
          status === 'SUSPENDED'
            ? '멤버십 상태가 변경되어 접근 권한이 해제되었습니다.'
            : '권한이 변경되어 다시 로그인해야 합니다.'
        );
        return { success: true };
      }
      await get().listMemberships();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  assignRole: async (membershipId, roleCode) => {
    try {
      const shouldReissue = isCurrentUsersMembership(get().myMemberships, membershipId);
      await apiFetch(`/memberships/${membershipId}/roles/${roleCode}`, { method: 'POST' });
      if (shouldReissue) {
        logoutWithNotice(get().setToken, '권한이 변경되어 다시 로그인해야 합니다.');
        return { success: true };
      }
      await get().listMemberships();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  revokeRole: async (membershipId, roleCode) => {
    try {
      const shouldReissue = isCurrentUsersMembership(get().myMemberships, membershipId);
      await apiFetch(`/memberships/${membershipId}/roles/${roleCode}`, { method: 'DELETE' });
      if (shouldReissue) {
        logoutWithNotice(get().setToken, '권한이 변경되어 다시 로그인해야 합니다.');
        return { success: true };
      }
      await get().listMemberships();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  applyTemplateToMembership: async (membershipId, templateCode, reason = 'Direct assignment') => {
    try {
      const shouldReissue = isCurrentUsersMembership(get().myMemberships, membershipId);
      await apiFetch(`/memberships/${membershipId}/permission-templates/${templateCode}/apply`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      if (shouldReissue) {
        logoutWithNotice(get().setToken, '권한이 변경되어 다시 로그인해야 합니다.');
        return { success: true };
      }
      await get().listMemberships();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  revokeTemplateFromMembership: async (membershipId, templateCode, reason = 'Direct revoke') => {
    try {
      const shouldReissue = isCurrentUsersMembership(get().myMemberships, membershipId);
      await apiFetch(`/memberships/${membershipId}/permission-templates/${templateCode}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      if (shouldReissue) {
        logoutWithNotice(get().setToken, '권한이 변경되어 다시 로그인해야 합니다.');
        return { success: true };
      }
      await get().listMemberships();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  // --- PLATFORM TEMPLATE ADMIN ACTIONS (Matches template-platform-admin.http) ---
  listRootPermissions: async () => {
    try {
      const data = await apiFetch('/admin/permission-templates/permissions');
      set({ rootPermissions: data || [] });
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  createRootPermission: async (perm) => {
    try {
      await apiFetch('/admin/permission-templates/permissions', {
        method: 'POST',
        body: JSON.stringify(perm)
      });
      await get().listRootPermissions();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  listPlatformTemplates: async () => {
    try {
      const data = await apiFetch('/admin/permission-templates');
      set({ platformTemplates: data || [] });
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  createPlatformTemplate: async (template) => {
    try {
      await apiFetch('/admin/permission-templates', {
        method: 'POST',
        body: JSON.stringify(template)
      });
      await get().listPlatformTemplates();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  updatePlatformTemplate: async (code, data) => {
    try {
      await apiFetch(`/admin/permission-templates/${code}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
      await get().listPlatformTemplates();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  replacePlatformTemplatePermissions: async (code, permissions) => {
    try {
      await apiFetch(`/admin/permission-templates/${code}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissionCodes: permissions })
      });
      await get().listPlatformTemplates();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  addPlatformTemplatePermissions: async (code, permissions) => {
    try {
      await apiFetch(`/admin/permission-templates/${code}/permissions`, {
        method: 'POST',
        body: JSON.stringify({ permissionCodes: permissions })
      });
      await get().listPlatformTemplates();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  removePlatformTemplatePermission: async (code, permission) => {
    try {
      await apiFetch(`/admin/permission-templates/${code}/permissions/${permission}`, { method: 'DELETE' });
      await get().listPlatformTemplates();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  // --- TENANT TEMPLATE ADMIN ACTIONS (Matches template-tenant-admin.http) ---
  listTenantTemplates: async () => {
    try {
      const { user } = get();
      if (!user?.tenantId) return { success: false };
      const data = await apiFetch(`/admin/tenants/${user.tenantId}/permission-templates`);
      set({ tenantTemplates: data || [] });
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  createTenantTemplate: async (template) => {
    try {
      const { user } = get();
      await apiFetch(`/admin/tenants/${user.tenantId}/permission-templates`, {
        method: 'POST',
        body: JSON.stringify(template)
      });
      await get().listTenantTemplates();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  updateTenantTemplate: async (code, data) => {
    try {
      const { user } = get();
      await apiFetch(`/admin/tenants/${user.tenantId}/permission-templates/${code}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
      await get().listTenantTemplates();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  replaceTenantTemplatePermissions: async (code, permissions) => {
    try {
      const { user } = get();
      await apiFetch(`/admin/tenants/${user.tenantId}/permission-templates/${code}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissionCodes: permissions })
      });
      await get().listTenantTemplates();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  addTenantTemplatePermissions: async (code, permissions) => {
    try {
      const { user } = get();
      await apiFetch(`/admin/tenants/${user.tenantId}/permission-templates/${code}/permissions`, {
        method: 'POST',
        body: JSON.stringify({ permissionCodes: permissions })
      });
      await get().listTenantTemplates();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  removeTenantTemplatePermission: async (code, permission) => {
    try {
      const { user } = get();
      await apiFetch(`/admin/tenants/${user.tenantId}/permission-templates/${code}/permissions/${permission}`, { method: 'DELETE' });
      await get().listTenantTemplates();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  listRoleBindings: async () => {
    try {
      const { user } = get();
      if (!user?.tenantId) return { success: false };
      const data = await apiFetch(`/admin/tenants/${user.tenantId}/role-templates`);

      // Transform [{ roleCode, templateCode }] to Map { roleCode: [templateCode, ...] }
      const bindings = {};
      if (Array.isArray(data)) {
        data.forEach(item => {
          if (!bindings[item.roleCode]) bindings[item.roleCode] = [];
          bindings[item.roleCode].push(item.templateCode);
        });
      }
      set({ roleBindings: bindings });
      return { success: true, data: bindings };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  bindTemplateToRole: async (roleCode, templateCode) => {
    try {
      const { user } = get();
      await apiFetch(`/admin/tenants/${user.tenantId}/role-templates`, {
        method: 'POST',
        body: JSON.stringify({ roleCode, templateCode })
      });
      await get().listRoleBindings();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  unbindTemplateFromRole: async (roleCode, templateCode) => {
    try {
      const { user } = get();
      await apiFetch(`/admin/tenants/${user.tenantId}/role-templates/${roleCode}/${templateCode}`, { method: 'DELETE' });
      await get().listRoleBindings();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  partnerLinks: [],

  // --- PARTNER LINK ACTIONS ---
  createPartnerLink: async (data) => {
    try {
      const response = await apiFetch('/workflows/partner-links', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      await get().fetchPartnerLinks();
      return { success: true, data: response };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  fetchPartnerLinks: async (status = '') => {
    try {
      const query = status ? `?status=${status}` : '';
      const data = await apiFetch(`/workflows/partner-links${query}`);
      set({ partnerLinks: data || [] });
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  approvePartnerLink: async (id) => {
    try {
      await apiFetch(`/workflows/admin/partner-links/${id}/approve`, { method: 'POST' });
      await get().fetchPartnerLinks();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  rejectPartnerLink: async (id, reason) => {
    try {
      await apiFetch(`/workflows/admin/partner-links/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      await get().fetchPartnerLinks();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  suspendPartnerLink: async (id) => {
    try {
      await apiFetch(`/workflows/partner-links/${id}/suspend`, { method: 'POST' });
      await get().fetchPartnerLinks();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  resumePartnerLink: async (id) => {
    try {
      await apiFetch(`/workflows/partner-links/${id}/resume`, { method: 'POST' });
      await get().fetchPartnerLinks();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  terminatePartnerLink: async (id, reason) => {
    try {
      await apiFetch(`/workflows/partner-links/${id}/terminate`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      await get().fetchPartnerLinks();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  searchTenants: async (name) => {
    try {
      if (!name) return { success: true, data: [] };
      const params = new URLSearchParams({
        status: 'ACTIVE',
        page: '0',
        size: '20',
        name: name.trim(),
      });
      const data = await apiFetch(`/tenants?${params.toString()}`);
      return { success: true, data: Array.isArray(data?.items) ? data.items : [] };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },
}));

export default useAuthStore;
