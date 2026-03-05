import { create } from 'zustand';

// Roles definition
export const ROLES = {
  USER: 'USER',
  BRAND: 'BRAND',
  RETAIL: 'RETAIL',
  SERVICE: 'SERVICE',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
};

export const TENANT_ROLES = {
  ADMIN: 'ADMIN',
  OPERATOR: 'OPERATOR',
  STAFF: 'STAFF',
};

export const ROLE_THEMES = {
  [ROLES.USER]: { name: '일반 회원', primary: '#111827', border: '#e5e7eb', bg: '#f9fafb' },
  [ROLES.BRAND]: { name: '브랜드(Brand)', primary: '#2563eb', border: '#bfdbfe', bg: '#eff6ff' },
  [ROLES.RETAIL]: { name: '리테일(Retail)', primary: '#16a34a', border: '#bbf7d0', bg: '#f0fdf4' },
  [ROLES.SERVICE]: { name: '서비스(Service)', primary: '#d97706', border: '#fde68a', bg: '#fffbeb' },
  [ROLES.PLATFORM_ADMIN]: { name: '플랫폼 관리자', primary: '#9333ea', border: '#e9d5ff', bg: '#faf5ff' },
};

// API Helper
const apiFetch = async (url, options = {}) => {
  const token = useAuthStore.getState().accessToken;
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    let errorMsg = 'API Error';
    try {
      const errorData = await response.json();
      errorMsg = errorData.message || errorMsg;
    } catch (e) {
      // Ignore JSON parse error if body is empty
    }
    throw new Error(errorMsg);
  }

  if (response.status === 204) return null;
  return response.json();
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
  memberships: [],
  roleBindings: {},
  applications: [],

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

  login: async (email, password, tenantId = null, groupId = null) => {
    try {
      set({ error: null });
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, tenantId, groupId }),
      });

      const userContext = {
        id: data.userId,
        email,
        tenantId: data.tenantId,
        groupId: data.groupId,
        role: email.includes('admin') ? ROLES.PLATFORM_ADMIN : ROLES.USER,
        availableRoles: [
          ROLES.USER,
          ...(data.tenantId ? [ROLES.BRAND] : []),
          ...(email.includes('admin') ? [ROLES.PLATFORM_ADMIN] : [])
        ]
      };

      // Store token and user
      get().setToken(data.accessToken, userContext);

      // Refresh role options after token is set
      await get().fetchMyMemberships();

      return { success: true, user: get().user || userContext };
    } catch (error) {
      set({ error: error.message });
      return { success: false, message: error.message };
    }
  },

  fetchMyMemberships: async () => {
    try {
      const memberships = await apiFetch('/me/memberships');
      const membershipRoles = (memberships || []).flatMap((m) => {
        const groupType = String(m?.groupType || '').toUpperCase();
        return ROLES[groupType] ? [ROLES[groupType]] : [];
      });

      let availableRoles = [ROLES.USER, ...membershipRoles];
      if (get().user?.email?.includes('admin')) {
        availableRoles.push(ROLES.PLATFORM_ADMIN);
      }
      availableRoles = [...new Set(availableRoles)];
      const activeMembership = (memberships || []).find((m) => String(m.status).toUpperCase() === 'ACTIVE') || memberships?.[0];
      const preferredRole = membershipRoles[0] || ROLES.USER;

      set(state => {
        const currentUser = state.user;
        if (!currentUser) return state; // Should be handled by App.js calling login or logout

        const shouldPromote = currentUser.role === ROLES.USER && membershipRoles.length > 0;
        const nextRole = shouldPromote
          ? preferredRole
          : (availableRoles.includes(currentUser.role) ? currentUser.role : ROLES.USER);

        const newUser = {
          ...currentUser,
          tenantId: activeMembership?.tenantId ?? currentUser.tenantId ?? null,
          groupId: activeMembership?.groupId ?? currentUser.groupId ?? null,
          role: nextRole,
          availableRoles,
        };
        localStorage.setItem('user', JSON.stringify(newUser));
        return { user: newUser };
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

  verifyPhone: async () => {
    try {
      await apiFetch('/auth/verify-phone', { method: 'POST' });
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  setRole: (newRole) => set((state) => {
    const nextUser = state.user ? { ...state.user, role: newRole } : null;
    if (nextUser) {
      localStorage.setItem('user', JSON.stringify(nextUser));
    }
    return { user: nextUser };
  }),

  // --- ONBOARDING ACTIONS ---
  submitApplication: async (application) => {
    try {
      const response = await apiFetch('/onboarding/applications', {
        method: 'POST',
        body: JSON.stringify({
          type: application.type, // RETAIL, BRAND, SERVICE
          orgName: application.orgName,
          country: application.country,
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

  presignEvidence: async (fileName, contentType) => {
    try {
      const data = await apiFetch('/onboarding/evidences/presign', {
        method: 'POST',
        body: JSON.stringify({ evidenceBundleId: null, fileName, contentType })
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

  // Admin APIs for onboarding
  listApplications: async (type = '') => {
    try {
      const query = type ? `?type=${type}` : '';
      const data = await apiFetch(`/admin/onboarding/applications${query}`);
      set({ applications: data || [] });
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  approveApplication: async (applicationId) => {
    try {
      await apiFetch(`/admin/onboarding/applications/${applicationId}/approve`, { method: 'POST' });
      // Refresh local list
      await get().listApplications();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  rejectApplication: async (applicationId, rejectReason) => {
    try {
      await apiFetch(`/admin/onboarding/applications/${applicationId}/reject`, {
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
      const data = await apiFetch(`/api/invitations/${invitationId}/accept`, { method: 'POST' });
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  listMemberships: async () => {
    try {
      const { user } = get();
      if (!user?.tenantId) return { success: false };
      const data = await apiFetch(`/tenants/${user.tenantId}/admin/memberships`);
      set({ memberships: data || [] });
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  inviteMember: async (email, roleCode) => {
    try {
      const { user } = get();
      if (!user?.tenantId || !user?.groupId) return { success: false };
      const data = await apiFetch(`/tenants/${user.tenantId}/admin/invitations`, {
        method: 'POST',
        body: JSON.stringify({ email, groupId: user.groupId, role: roleCode })
      });
      await get().listMemberships();
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  updateMembershipStatus: async (membershipId, status) => {
    try {
      const { user } = get();
      await apiFetch(`/tenants/${user.tenantId}/admin/memberships/${membershipId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      await get().listMemberships();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  assignRole: async (membershipId, roleCode) => {
    try {
      const { user } = get();
      await apiFetch(`/tenants/${user.tenantId}/admin/memberships/${membershipId}/roles/${roleCode}`, { method: 'POST' });
      await get().listMemberships();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  revokeRole: async (membershipId, roleCode) => {
    try {
      const { user } = get();
      await apiFetch(`/tenants/${user.tenantId}/admin/memberships/${membershipId}/roles/${roleCode}`, { method: 'DELETE' });
      await get().listMemberships();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  applyTemplateToMembership: async (membershipId, templateCode, reason = 'Direct assignment') => {
    try {
      const { user } = get();
      await apiFetch(`/tenants/${user.tenantId}/admin/memberships/${membershipId}/permission-templates/${templateCode}/apply`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      await get().listMemberships();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  revokeTemplateFromMembership: async (membershipId, templateCode, reason = 'Direct revoke') => {
    try {
      const { user } = get();
      await apiFetch(`/tenants/${user.tenantId}/admin/memberships/${membershipId}/permission-templates/${templateCode}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
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

}));

export default useAuthStore;
