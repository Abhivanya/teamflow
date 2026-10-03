import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Field, Notice, TextArea, TextInput } from '../components/ui';
import { useOrg } from '../hooks/org';
import { api } from '../lib/api';
import { errorMessage, formatWhen } from '../lib/format';
import { can } from '../lib/permissions';
import { queryClient } from '../lib/query';
import type { Project } from '../lib/types';

export function ProjectsPage() {
  const { current } = useOrg();
  const [status, setStatus] = useState('active');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', dueDate: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(q), 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  const projects = useQuery({
    queryKey: ['projects', current?.id, status, debounced],
    enabled: Boolean(current),
    queryFn: async () => {
      const res = await api.get<{ data: Project[] }>('/projects', { params: { status, q: debounced } });
      return res.data.data;
    },
  });

  const create = useMutation({
    mutationFn: () =>
      api.post('/projects', {
        name: form.name,
        description: form.description,
        dueDate: form.dueDate || null,
      }),
    onSuccess: () => {
      setOpen(false);
      setForm({ name: '', description: '', dueDate: '' });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error) => setMessage(errorMessage(error)),
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">Projects</h1>
          <p className="text-sm text-muted">Active work sits here. Archived projects stay out of the default list.</p>
        </div>
        {can(current?.role, 'project.create') ? <Button onClick={() => setOpen(true)}>New project</Button> : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {['active', 'completed', 'archived', 'all'].map((item) => (
          <button
            key={item}
            className={`rounded-full px-3 py-1 text-sm ${status === item ? 'bg-ink text-white' : 'bg-card'}`}
            onClick={() => setStatus(item)}
          >
            {item}
          </button>
        ))}
        <TextInput
          className="max-w-xs"
          placeholder="Filter by name"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      </div>
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-card">
        {(projects.data ?? []).map((project) => (
          <li key={project.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <Link className="font-medium" to={`/projects/${project.id}`}>{project.name}</Link>
              <p className="text-sm text-muted">{project.description || 'No description'}</p>
            </div>
            <div className="text-right text-xs text-muted">
              <p>{project.status}</p>
              <p>{project.dueDate ? `Due ${formatWhen(project.dueDate)}` : ''}</p>
            </div>
          </li>
        ))}
        {projects.data?.length === 0 ? <li className="px-4 py-6 text-sm text-muted">No projects in this view.</li> : null}
      </ul>
      {open ? (
        <div className="fixed inset-0 z-20 grid place-items-center bg-ink/30 p-4" onClick={() => setOpen(false)}>
          <form
            className="w-full max-w-md space-y-3 rounded-xl bg-card p-5"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <h2 className="text-lg font-medium">New project</h2>
            <Field label="Name">
              <TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </Field>
            <Field label="Description">
              <TextArea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
            </Field>
            <Field label="Due date">
              <TextInput type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
            </Field>
            {message ? <Notice>{message}</Notice> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>Create</Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
