import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useOrg } from '../hooks/org';
import { api } from '../lib/api';
import { STATUS_LABEL } from '../lib/format';
import type { TaskStatus } from '../lib/types';

type Result = {
  projects: { id: string; name: string; status: string }[];
  tasks: { id: string; title: string; status: TaskStatus; projectId: string }[];
  members: { userId: string; name: string; email: string; role: string }[];
};

export function SearchPage() {
  const { current } = useOrg();
  const [params, setParams] = useSearchParams();
  const initial = params.get('q') ?? '';
  const [value, setValue] = useState(initial);
  const [q, setQ] = useState(initial);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(value);
      setParams(value ? { q: value } : {});
    }, 300);
    return () => window.clearTimeout(timer);
  }, [value, setParams]);

  const search = useQuery({
    queryKey: ['search', current?.id, q],
    enabled: Boolean(current && q.trim().length >= 2),
    queryFn: async () => (await api.get<{ data: Result }>('/search', { params: { q } })).data.data,
  });

  return (
    <div>
      <h1 className="font-serif text-3xl">Search</h1>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="At least 2 characters"
        className="mt-4 w-full max-w-lg rounded-md border border-line bg-card px-3 py-2 text-sm outline-none focus:border-moss"
      />
      {q.trim().length < 2 ? <p className="mt-4 text-sm text-muted">Type a bit more.</p> : null}
      {search.data ? (
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <section>
            <h2 className="text-sm font-medium">Projects</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {search.data.projects.map((project) => (
                <li key={project.id}><Link to={`/projects/${project.id}`}>{project.name}</Link></li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="text-sm font-medium">Tasks</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {search.data.tasks.map((task) => (
                <li key={task.id}>
                  <Link to={`/projects/${task.projectId}?task=${task.id}`}>{task.title}</Link>
                  <span className="text-muted"> · {STATUS_LABEL[task.status]}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="text-sm font-medium">People</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {search.data.members.map((member) => (
                <li key={member.userId}>{member.name} <span className="text-muted">{member.email}</span></li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}
