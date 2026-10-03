import { useMutation } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button, Notice } from '../components/ui';
import { useMe } from '../hooks/org';
import { api, storeOrgId } from '../lib/api';
import { errorMessage } from '../lib/format';
import { queryClient } from '../lib/query';

export function InvitePage() {
  const { token = '' } = useParams();
  const me = useMe();
  const navigate = useNavigate();
  const accept = useMutation({
    mutationFn: async () => (await api.post<{ data: { organizationId: string } }>(`/invites/${token}/accept`)).data.data,
    onSuccess: async (data) => {
      storeOrgId(data.organizationId);
      await queryClient.invalidateQueries({ queryKey: ['orgs'] });
      navigate('/dashboard');
    },
  });

  if (me.isLoading) return <p className="p-8 text-sm">Checking your session…</p>;
  if (me.isError) return <Navigate to={`/login?next=/invite/${token}`} replace />;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="font-serif text-3xl text-moss">TeamFlow</p>
      <h1 className="mt-4 text-xl font-medium">Join this organization</h1>
      <p className="mt-2 text-sm text-muted">You are signed in as {me.data?.email}. The invite has to match that address.</p>
      {accept.isError ? <div className="mt-4"><Notice>{errorMessage(accept.error)}</Notice></div> : null}
      <Button className="mt-6" onClick={() => accept.mutate()} disabled={accept.isPending}>Accept invite</Button>
      <Link className="mt-4 text-sm text-moss" to="/dashboard">Not now</Link>
    </div>
  );
}
