import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'X-Teamflow-Client': 'web' },
});

const ORG_KEY = 'teamflow.orgId';

export function storedOrgId() {
  return localStorage.getItem(ORG_KEY) ?? '';
}

export function storeOrgId(id: string) {
  localStorage.setItem(ORG_KEY, id);
}

api.interceptors.request.use((config) => {
  const orgId = storedOrgId();
  if (orgId) config.headers['X-Organization-Id'] = orgId;
  return config;
});

let refresh: Promise<void> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const url: string = original?.url ?? '';
    const skip =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/forgot-password');

    if (error.response?.status !== 401 || original?._retry || skip) {
      return Promise.reject(error);
    }

    original._retry = true;
    refresh ??= api
      .post('/auth/refresh')
      .then(() => undefined)
      .finally(() => {
        refresh = null;
      });

    try {
      await refresh;
    } catch {
      return Promise.reject(error);
    }
    return api(original);
  },
);
