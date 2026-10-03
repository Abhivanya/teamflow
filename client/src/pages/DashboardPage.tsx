import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Spinner } from '../components/ui';
import { useOrg } from '../hooks/org';
import { api } from '../lib/api';
import { formatWhen, STATUS_LABEL } from '../lib/format';
import type { Dashboard, TaskStatus } from '../lib/types';

export function DashboardPage() {
  const { current } = useOrg();
  const dash = useQuery({
    queryKey: ['dashboard', current?.id],
    enabled: Boolean(current),
    queryFn: async () => (await api.get<{ data: Dashboard }>('/dashboard')).data.data,
  });

  if (!current || dash.isLoading) return <Spinner label="Loading dashboard" />;
  if (!dash.data) return <p className="text-sm text-muted">Dashboard is unavailable.</p>;

  const stats = [
    ['Projects', dash.data.totalProjects],
    ['Active', dash.data.activeProjects],
    ['Completed', dash.data.completedProjects],
    ['Open tasks', dash.data.openTasks],
    ['Overdue', dash.data.overdueTasks],
  ];
  const maxStatus = Math.max(1, ...dash.data.tasksByStatus.map((row) => row.count));
  const maxPeople = Math.max(1, ...dash.data.memberActivity.map((row) => row.count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">{current.name}</h1>
        <p className="text-sm text-muted">What is moving, and what is late.</p>
      </div>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map(([label, value]) => (
          <article key={label} className="rounded-xl border border-line bg-card px-4 py-3">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-2xl font-medium">{value}</p>
          </article>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-line bg-card p-4">
          <h2 className="text-sm font-medium">Tasks by status</h2>
          <ul className="mt-3 space-y-2">
            {dash.data.tasksByStatus.map((row) => (
              <li key={row.status}>
                <div className="mb-1 flex justify-between text-xs text-muted">
                  <span>{STATUS_LABEL[row.status as TaskStatus] ?? row.status}</span>
                  <span>{row.count}</span>
                </div>
                <div className="h-2 rounded bg-sidebar">
                  <div className="h-2 rounded bg-moss" style={{ width: `${(row.count / maxStatus) * 100}%` }} />
                </div>
              </li>
            ))}
            {dash.data.tasksByStatus.length === 0 ? <li className="text-sm text-muted">No tasks yet.</li> : null}
          </ul>
        </article>
        <article className="rounded-xl border border-line bg-card p-4">
          <h2 className="text-sm font-medium">Who has been active</h2>
          <ul className="mt-3 space-y-2">
            {dash.data.memberActivity.map((row) => (
              <li key={row.name}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{row.name}</span>
                  <span className="text-muted">{row.count}</span>
                </div>
                <div className="h-2 rounded bg-sidebar">
                  <div className="h-2 rounded bg-ink/70" style={{ width: `${(row.count / maxPeople) * 100}%` }} />
                </div>
              </li>
            ))}
            {dash.data.memberActivity.length === 0 ? <li className="text-sm text-muted">No activity in the last two weeks.</li> : null}
          </ul>
        </article>
      </section>
      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <article className="rounded-xl border border-line bg-card p-4">
          <h2 className="text-sm font-medium">Project progress</h2>
          <ul className="mt-3 divide-y divide-line">
            {dash.data.projectProgress.map((project) => (
              <li key={project.id} className="flex items-center justify-between py-2 text-sm">
                <Link className="font-medium" to={`/projects/${project.id}`}>{project.name}</Link>
                <span className="text-muted">{project.percent}% · {project.done}/{project.total}</span>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-xl border border-line bg-card p-4">
          <h2 className="text-sm font-medium">Recent activity</h2>
          <ul className="mt-3 space-y-2">
            {dash.data.recentActivity.map((item) => (
              <li key={item.id} className="text-sm">
                {item.text}
                <span className="text-muted"> · {formatWhen(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
