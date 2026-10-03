import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, storeOrgId, storedOrgId } from '../lib/api';
import { queryClient } from '../lib/query';
import type { Org, User } from '../lib/types';

const OrgContext = createContext<{
  orgs: Org[];
  current: Org | null;
  loading: boolean;
  switchOrg: (id: string) => void;
} | null>(null);

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<{ data: User }>('/auth/me')).data.data,
    retry: false,
  });
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const orgs = useQuery({
    queryKey: ['orgs'],
    queryFn: async () => (await api.get<{ data: Org[] }>('/organizations')).data.data,
  });
  const [orgId, setOrgId] = useState(storedOrgId);

  useEffect(() => {
    const list = orgs.data;
    if (!list?.length) return;
    if (!list.some((org) => org.id === orgId)) {
      storeOrgId(list[0].id);
      setOrgId(list[0].id);
    }
  }, [orgs.data, orgId]);

  function switchOrg(id: string) {
    storeOrgId(id);
    setOrgId(id);
    queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] !== 'me' && query.queryKey[0] !== 'orgs',
    });
  }

  const current = orgs.data?.find((org) => org.id === orgId) ?? null;

  return (
    <OrgContext.Provider value={{ orgs: orgs.data ?? [], current, loading: orgs.isLoading, switchOrg }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const value = useContext(OrgContext);
  if (!value) throw new Error('useOrg must be used inside OrgProvider');
  return value;
}
