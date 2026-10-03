import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMe, useOrg } from '../hooks/org';
import { api, storeOrgId } from '../lib/api';
import { errorMessage } from '../lib/format';
import { queryClient } from '../lib/query';
import { socket } from '../lib/socket';
import type { NotificationItem } from '../lib/types';
import { Button, Field, Notice, TextInput } from './ui';

const links = [
  ['/dashboard', 'Dashboard'],
  ['/projects', 'Projects'],
  ['/members', 'Members'],
  ['/settings', 'Settings'],
];

export function Shell() {
  const me = useMe();
  const org = useOrg();
  const navigate = useNavigate();
  const [live, setLive] = useState(socket.connected);
  const [openNotes, setOpenNotes] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    socket.connect();
    const onConnect = () => setLive(true);
    const onDisconnect = () => setLive(false);
    const onNote = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('notification:new', onNote);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('notification:new', onNote);
      socket.disconnect();
    };
  }, []);

  const notes = useQuery({
    queryKey: ['notifications', org.current?.id],
    enabled: Boolean(org.current),
    queryFn: async () => {
      const res = await api.get<{ data: NotificationItem[]; meta: { unread: number } }>('/notifications');
      return res.data;
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  async function logout() {
    await api.post('/auth/logout');
    queryClient.clear();
    navigate('/login');
  }

  if (!org.loading && org.orgs.length === 0) {
    return <CreateOrg name={me.data?.name ?? ''} />;
  }

  function onSearch(event: FormEvent) {
    event.preventDefault();
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      <aside className="flex flex-col bg-sidebar px-3 py-4 md:min-h-screen">
        <div className="px-2">
          <p className="font-serif text-2xl text-moss">TeamFlow</p>
          <p className="mt-1 text-xs text-muted">{live ? 'Live' : 'Reconnecting'}</p>
        </div>
        <label className="mt-4 block px-2 text-xs text-muted">
          Organization
          <select
            className="mt-1 w-full rounded-md border border-line bg-card px-2 py-2 text-sm text-ink"
            value={org.current?.id ?? ''}
            onChange={(event) => org.switchOrg(event.target.value)}
          >
            {org.orgs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <nav className="mt-4 flex gap-1 overflow-auto md:flex-col">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-card font-medium' : 'text-muted hover:bg-black/5'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 flex items-center justify-between gap-2 px-2 md:mt-auto">
          <div>
            <p className="text-sm font-medium">{me.data?.name}</p>
            <p className="text-xs text-muted">{org.current?.role.toLowerCase()}</p>
          </div>
          <button className="text-sm text-muted hover:text-ink" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <form onSubmit={onSearch} className="flex-1">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects, tasks, people"
              className="w-full max-w-md rounded-md border border-line bg-card px-3 py-2 text-sm outline-none focus:border-moss"
            />
          </form>
          <div className="relative">
            <button
              className="rounded-md border border-line bg-card px-3 py-2 text-sm"
              onClick={() => setOpenNotes((open) => !open)}
            >
              Inbox{notes.data?.meta.unread ? ` (${notes.data.meta.unread})` : ''}
            </button>
            {openNotes ? (
              <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-line bg-card p-2 shadow-lg">
                <div className="mb-2 flex justify-end">
                  <button
                    className="text-xs text-muted"
                    onClick={() => api.post('/notifications/read-all').then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }))}
                  >
                    Mark all read
                  </button>
                </div>
                {(notes.data?.data ?? []).length === 0 ? <p className="px-2 py-3 text-sm text-muted">Nothing new.</p> : null}
                {(notes.data?.data ?? []).map((item) => (
                  <button
                    key={item.id}
                    className={`block w-full rounded-md px-2 py-2 text-left text-sm hover:bg-paper ${item.read ? 'text-muted' : ''}`}
                    onClick={() => {
                      markRead.mutate(item.id);
                      setOpenNotes(false);
                      if (item.link) navigate(item.link);
                    }}
                  >
                    <span className="block font-medium text-ink">{item.title}</span>
                    <span className="block text-muted">{item.body}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </header>
        {!me.data?.emailVerifiedAt ? (
          <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-2 text-sm">
            <span>Email is not verified yet. Check the server log for the link if SMTP is off.</span>
            <button className="text-moss" onClick={() => api.post('/auth/resend-verification')}>
              Resend
            </button>
          </div>
        ) : null}
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function CreateOrg({ name }: { name: string }) {
  const [orgName, setOrgName] = useState('');
  const [message, setMessage] = useState('');
  const org = useOrg();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      const res = await api.post<{ data: { id: string } }>('/organizations', { name: orgName });
      storeOrgId(res.data.data.id);
      await queryClient.invalidateQueries({ queryKey: ['orgs'] });
      org.switchOrg(res.data.data.id);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="font-serif text-3xl text-moss">TeamFlow</p>
      <h1 className="mt-6 text-xl font-medium">Create your first organization, {name.split(' ')[0]}</h1>
      <p className="mt-2 text-sm text-muted">Everything you add after this stays inside that organization.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <Field label="Organization name">
          <TextInput value={orgName} onChange={(event) => setOrgName(event.target.value)} required minLength={2} />
        </Field>
        {message ? <Notice>{message}</Notice> : null}
        <Button type="submit">Create organization</Button>
      </form>
    </div>
  );
}
