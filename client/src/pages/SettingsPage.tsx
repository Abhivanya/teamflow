import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Field, Notice, TextInput } from '../components/ui';
import { useMe, useOrg } from '../hooks/org';
import { api } from '../lib/api';
import { errorMessage, formatWhen } from '../lib/format';
import { can } from '../lib/permissions';
import { queryClient } from '../lib/query';

type Session = { id: string; userAgent: string; createdAt: string };

export function SettingsPage() {
  const me = useMe();
  const org = useOrg();
  const navigate = useNavigate();
  const [name, setName] = useState(me.data?.name ?? '');
  const [orgName, setOrgName] = useState(org.current?.name ?? '');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (me.data?.name) setName(me.data.name);
  }, [me.data?.name]);

  useEffect(() => {
    if (org.current?.name) setOrgName(org.current.name);
  }, [org.current?.name]);

  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => (await api.get<{ data: Session[] }>('/auth/sessions')).data.data,
  });

  const saveProfile = useMutation({
    mutationFn: () => api.patch('/auth/me', { name }),
    onSuccess: (res) => {
      queryClient.setQueryData(['me'], res.data.data);
      setMessage('Profile saved');
    },
    onError: (error) => setMessage(errorMessage(error)),
  });

  const saveOrg = useMutation({
    mutationFn: () => api.patch('/organization', { name: orgName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgs'] });
      setMessage('Organization saved');
    },
    onError: (error) => setMessage(errorMessage(error)),
  });

  const leave = useMutation({
    mutationFn: () => api.post('/leave'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['orgs'] });
      navigate('/dashboard');
    },
    onError: (error) => setMessage(errorMessage(error)),
  });

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="font-serif text-3xl">Settings</h1>
        <p className="text-sm text-muted">Your name, this organization, and the sessions that can refresh your login.</p>
      </div>
      {message ? <Notice>{message}</Notice> : null}
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          saveProfile.mutate();
        }}
      >
        <h2 className="font-medium">Profile</h2>
        <Field label="Name">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <p className="text-sm text-muted">{me.data?.email}</p>
        <Button type="submit">Save profile</Button>
      </form>
      {org.current && can(org.current.role, 'organization.update') ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            saveOrg.mutate();
          }}
        >
          <h2 className="font-medium">Organization</h2>
          <Field label="Name">
            <TextInput value={orgName} onChange={(event) => setOrgName(event.target.value)} />
          </Field>
          <Button type="submit">Save organization</Button>
        </form>
      ) : null}
      {org.current && org.current.role !== 'OWNER' ? (
        <div>
          <h2 className="font-medium">Leave {org.current.name}</h2>
          <p className="mt-1 text-sm text-muted">You lose access immediately. The owner has to stay.</p>
          <Button className="mt-3" variant="danger" onClick={() => leave.mutate()}>Leave organization</Button>
        </div>
      ) : null}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Sessions</h2>
          <Button
            variant="ghost"
            onClick={async () => {
              await api.post('/auth/logout-all');
              queryClient.clear();
              navigate('/login');
            }}
          >
            Log out everywhere
          </Button>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {(sessions.data ?? []).map((session) => (
            <li key={session.id} className="rounded-md border border-line bg-card px-3 py-2">
              <p className="truncate">{session.userAgent || 'Unknown browser'}</p>
              <p className="text-xs text-muted">Started {formatWhen(session.createdAt)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
