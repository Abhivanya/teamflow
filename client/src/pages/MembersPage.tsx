import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Field, Notice, SelectInput, TextInput } from '../components/ui';
import { useOrg } from '../hooks/org';
import { api } from '../lib/api';
import { errorMessage } from '../lib/format';
import { can } from '../lib/permissions';
import { queryClient } from '../lib/query';
import type { Member, Role } from '../lib/types';

const roles: Role[] = ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'];

export function MembersPage() {
  const { current } = useOrg();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('MEMBER');
  const [message, setMessage] = useState('');

  const members = useQuery({
    queryKey: ['members', current?.id],
    enabled: Boolean(current),
    queryFn: async () => (await api.get<{ data: Member[] }>('/members')).data.data,
  });

  const invite = useMutation({
    mutationFn: () => api.post('/invites', { email, role }),
    onSuccess: () => {
      setEmail('');
      setMessage('Invite sent. Without SMTP, the link is in the API log.');
    },
    onError: (error) => setMessage(errorMessage(error)),
  });

  const change = useMutation({
    mutationFn: (input: { id: string; role: Role }) => api.patch(`/members/${input.id}`, { role: input.role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/members/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
    onError: (error) => setMessage(errorMessage(error)),
  });

  return (
    <div>
      <h1 className="font-serif text-3xl">Members</h1>
      <p className="text-sm text-muted">Roles decide what someone can change. They do not cross organization lines.</p>
      {can(current?.role, 'member.invite') ? (
        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            invite.mutate();
          }}
        >
          <Field label="Email">
            <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </Field>
          <Field label="Role">
            <SelectInput value={role} onChange={(event) => setRole(event.target.value as Role)}>
              {roles.map((item) => <option key={item} value={item}>{item.toLowerCase()}</option>)}
            </SelectInput>
          </Field>
          <Button type="submit" disabled={invite.isPending}>Invite</Button>
        </form>
      ) : null}
      {message ? <div className="mt-3"><Notice>{message}</Notice></div> : null}
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-card">
        {(members.data ?? []).map((member) => (
          <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium">{member.name}</p>
              <p className="text-sm text-muted">{member.email}</p>
            </div>
            {can(current?.role, 'member.update') && member.role !== 'OWNER' ? (
              <div className="flex items-center gap-2">
                <SelectInput
                  value={member.role}
                  onChange={(event) => member.id && change.mutate({ id: member.id, role: event.target.value as Role })}
                >
                  {roles.map((item) => <option key={item} value={item}>{item.toLowerCase()}</option>)}
                </SelectInput>
                {can(current?.role, 'member.remove') ? (
                  <Button variant="ghost" onClick={() => member.id && remove.mutate(member.id)}>Remove</Button>
                ) : null}
              </div>
            ) : (
              <span className="text-sm text-muted">{member.role?.toLowerCase()}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
