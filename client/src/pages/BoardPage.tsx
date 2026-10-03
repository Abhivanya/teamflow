import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Board } from '../components/Board';
import { TaskDrawer } from '../components/TaskDrawer';
import { Button, Field, Notice, TextInput } from '../components/ui';
import { useOrg } from '../hooks/org';
import { api } from '../lib/api';
import { errorMessage } from '../lib/format';
import { can } from '../lib/permissions';
import { queryClient } from '../lib/query';
import { socket } from '../lib/socket';
import type { Priority, Project, Task } from '../lib/types';

export function BoardPage() {
  const { projectId = '' } = useParams();
  const { current } = useOrg();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [memberEmail, setMemberEmail] = useState('');
  const [message, setMessage] = useState('');
  const openTask = params.get('task');

  const project = useQuery({
    queryKey: ['project', projectId, current?.id],
    enabled: Boolean(projectId && current),
    queryFn: async () => (await api.get<{ data: Project }>(`/projects/${projectId}`)).data.data,
  });

  const tasks = useQuery({
    queryKey: ['tasks', projectId],
    enabled: Boolean(projectId && current),
    queryFn: async () => (await api.get<{ data: Task[] }>(`/projects/${projectId}/tasks`, { params: { limit: 200 } })).data.data,
  });

  useEffect(() => {
    if (!projectId) return;
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['task'] });
    };
    const join = () => socket.emit('join:project', projectId);
    join();
    socket.on('connect', join);
    socket.on('task:changed', refresh);
    return () => {
      socket.emit('leave:project', projectId);
      socket.off('connect', join);
      socket.off('task:changed', refresh);
    };
  }, [projectId]);

  const create = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/tasks`, { title, priority }),
    onSuccess: () => {
      setTitle('');
      setCreating(false);
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
    onError: (error) => setMessage(errorMessage(error)),
  });

  const addMember = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/members`, { email: memberEmail }),
    onSuccess: () => {
      setMemberEmail('');
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (error) => setMessage(errorMessage(error)),
  });

  const archive = useMutation({
    mutationFn: () => api.patch(`/projects/${projectId}`, { status: project.data?.status === 'archived' ? 'active' : 'archived' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
  });

  if (project.isLoading) return <p className="text-sm text-muted">Loading project…</p>;
  if (project.isError) return <Notice>{errorMessage(project.error)}</Notice>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">{project.data?.name}</h1>
          <p className="max-w-xl text-sm text-muted">{project.data?.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(current?.role, 'task.create') ? <Button onClick={() => setCreating((open) => !open)}>New task</Button> : null}
          {can(current?.role, 'project.update') ? (
            <Button variant="ghost" onClick={() => archive.mutate()}>
              {project.data?.status === 'archived' ? 'Unarchive' : 'Archive'}
            </Button>
          ) : null}
        </div>
      </div>
      {creating ? (
        <form
          className="mb-4 flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <Field label="Title">
            <TextInput value={title} onChange={(event) => setTitle(event.target.value)} required className="min-w-64" />
          </Field>
          <Field label="Priority">
            <select className="rounded-md border border-line bg-card px-3 py-2 text-sm" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
              {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Button type="submit" disabled={create.isPending}>Add</Button>
        </form>
      ) : null}
      {message ? <div className="mb-3"><Notice>{message}</Notice></div> : null}
      <Board projectId={projectId} tasks={tasks.data ?? []} onOpen={(id) => setParams({ task: id })} />
      {can(current?.role, 'project.update') ? (
        <form
          className="mt-6 flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            addMember.mutate();
          }}
        >
          <Field label="Add someone already in the organization">
            <TextInput type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="email" />
          </Field>
          <Button type="submit" variant="ghost">Add to project</Button>
          <p className="text-xs text-muted">
            {(project.data?.members ?? []).map((member) => member.name).join(', ') || 'No members yet'}
          </p>
        </form>
      ) : null}
      {openTask ? (
        <TaskDrawer taskId={openTask} role={current?.role} onClose={() => setParams({})} />
      ) : null}
    </div>
  );
}
