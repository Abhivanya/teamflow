import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { dateInput, errorMessage, formatWhen, STATUS_LABEL, STATUSES } from '../lib/format';
import { can } from '../lib/permissions';
import { queryClient } from '../lib/query';
import type { Comment, Priority, Project, Role, Task, TaskStatus } from '../lib/types';
import { Button, Field, Notice, SelectInput, TextArea, TextInput } from './ui';

export function TaskDrawer({
  taskId,
  role,
  onClose,
}: {
  taskId: string;
  role?: Role;
  onClose: () => void;
}) {
  const task = useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => (await api.get<{ data: Task }>(`/tasks/${taskId}`)).data.data,
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-ink/30" onClick={onClose}>
      <aside className="h-full w-full max-w-lg overflow-auto bg-card p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-muted">Task</p>
          <button className="text-sm text-muted" onClick={onClose}>Close</button>
        </div>
        {task.isLoading ? <p className="mt-6 text-sm text-muted">Loading task…</p> : null}
        {task.isError ? <Notice>{errorMessage(task.error)}</Notice> : null}
        {task.data ? <TaskBody task={task.data} role={role} onClose={onClose} /> : null}
      </aside>
    </div>
  );
}

function TaskBody({ task, role, onClose }: { task: Task; role?: Role; onClose: () => void }) {
  const project = useQuery({
    queryKey: ['project', task.projectId],
    queryFn: async () => (await api.get<{ data: Project }>(`/projects/${task.projectId}`)).data.data,
  });
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [assigneeId, setAssigneeId] = useState(task.assignee?.id ?? '');
  const [dueDate, setDueDate] = useState(dateInput(task.dueDate));
  const [labels, setLabels] = useState(task.labels);
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editable = can(role, 'task.update');

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description);
    setStatus(task.status);
    setPriority(task.priority);
    setAssigneeId(task.assignee?.id ?? '');
    setDueDate(dateInput(task.dueDate));
    setLabels(task.labels);
  }, [task]);

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/tasks/${task.id}`, {
        title,
        description,
        status,
        priority,
        assigneeId: assigneeId || null,
        dueDate: dueDate || null,
        labels,
        updatedAt: task.updatedAt,
      }),
    onSuccess: () => {
      setMessage('Saved');
      queryClient.invalidateQueries({ queryKey: ['task', task.id] });
      queryClient.invalidateQueries({ queryKey: ['tasks', task.projectId] });
    },
    onError: (error) => setMessage(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/tasks/${task.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', task.projectId] });
      onClose();
    },
  });

  return (
    <div className="mt-4 space-y-4">
      <TextInput value={title} onChange={(event) => setTitle(event.target.value)} disabled={!editable} />
      <TextArea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} disabled={!editable} placeholder="Description" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <SelectInput value={status} disabled={!editable} onChange={(event) => setStatus(event.target.value as TaskStatus)}>
            {STATUSES.map((item) => (
              <option key={item} value={item}>{STATUS_LABEL[item]}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Priority">
          <SelectInput value={priority} disabled={!editable} onChange={(event) => setPriority(event.target.value as Priority)}>
            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((item) => (
              <option key={item} value={item}>{item.toLowerCase()}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Assignee">
          <SelectInput value={assigneeId} disabled={!editable} onChange={(event) => setAssigneeId(event.target.value)}>
            <option value="">Unassigned</option>
            {(project.data?.members ?? []).map((member) => (
              <option key={member.userId} value={member.userId}>{member.name}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Due date">
          <TextInput type="date" value={dueDate} disabled={!editable} onChange={(event) => setDueDate(event.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        {(project.data?.labels ?? []).map((label) => {
          const on = labels.includes(label.name);
          return (
            <button
              key={label.id}
              type="button"
              disabled={!editable}
              onClick={() => setLabels(on ? labels.filter((name) => name !== label.name) : [...labels, label.name])}
              className={`rounded-full px-2 py-1 text-xs ${on ? 'bg-moss text-white' : 'bg-sidebar'}`}
            >
              {label.name}
            </button>
          );
        })}
      </div>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
      {editable ? (
        <div className="flex gap-2">
          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
          {can(role, 'task.delete') ? (
            confirmDelete ? (
              <Button type="button" variant="danger" onClick={() => remove.mutate()}>Confirm delete</Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Button>
            )
          ) : null}
        </div>
      ) : null}
      <Comments task={task} role={role} />
      <Files task={task} role={role} />
      <section>
        <h3 className="text-sm font-medium">Activity</h3>
        <ul className="mt-2 space-y-2">
          {(task.activity ?? []).map((item) => (
            <li key={item.id} className="text-sm text-muted">
              <span className="text-ink">{item.text}</span>
              <span> · {formatWhen(item.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Comments({ task, role }: { task: Task; role?: Role }) {
  const [body, setBody] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const comments = task.comments ?? [];

  const add = useMutation({
    mutationFn: () => api.post(`/tasks/${task.id}/comments`, { body, parentId }),
    onSuccess: () => {
      setBody('');
      setParentId(null);
      queryClient.invalidateQueries({ queryKey: ['task', task.id] });
    },
  });

  const edit = useMutation({
    mutationFn: () => api.patch(`/comments/${editing}`, { body: draft }),
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['task', task.id] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/comments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task', task.id] }),
  });

  const roots = comments.filter((comment) => !comment.parentId);

  return (
    <section>
      <h3 className="text-sm font-medium">Comments</h3>
      <ul className="mt-2 space-y-3">
        {roots.map((comment) => (
          <li key={comment.id}>
            <CommentRow
              comment={comment}
              onReply={() => setParentId(comment.id)}
              onEdit={() => {
                setEditing(comment.id);
                setDraft(comment.body);
              }}
              onDelete={() => remove.mutate(comment.id)}
            />
            {editing === comment.id ? (
              <div className="mt-2 space-y-2">
                <TextArea value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} />
                <Button type="button" onClick={() => edit.mutate()}>Update comment</Button>
              </div>
            ) : null}
            <ul className="mt-2 space-y-2 border-l border-line pl-3">
              {comments.filter((reply) => reply.parentId === comment.id).map((reply) => (
                <li key={reply.id}>
                  <CommentRow comment={reply} onDelete={() => remove.mutate(reply.id)} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {can(role, 'comment.create') ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate();
          }}
        >
          {parentId ? <p className="text-xs text-muted">Replying <button type="button" onClick={() => setParentId(null)}>cancel</button></p> : null}
          <TextArea value={body} onChange={(event) => setBody(event.target.value)} rows={3} placeholder="Write a comment. Use @name to mention someone." />
          <Button type="submit" disabled={add.isPending || !body.trim()}>Comment</Button>
          {add.isError ? <Notice>{errorMessage(add.error)}</Notice> : null}
        </form>
      ) : null}
    </section>
  );
}

function CommentRow({
  comment,
  onReply,
  onEdit,
  onDelete,
}: {
  comment: Comment;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="text-sm">
      <p className="font-medium">{comment.author?.name ?? 'Someone'}</p>
      <p className="whitespace-pre-wrap">{comment.body}</p>
      <p className="mt-1 space-x-2 text-xs text-muted">
        <span>{formatWhen(comment.createdAt)}</span>
        {onReply ? <button onClick={onReply}>Reply</button> : null}
        {onEdit ? <button onClick={onEdit}>Edit</button> : null}
        {onDelete ? <button onClick={onDelete}>Delete</button> : null}
      </p>
    </div>
  );
}

function Files({ task, role }: { task: Task; role?: Role }) {
  const upload = useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append('file', file);
      return api.post(`/tasks/${task.id}/attachments`, body);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task', task.id] }),
  });

  async function download(id: string, name: string) {
    const res = await api.get(`/attachments/${id}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section>
      <h3 className="text-sm font-medium">Files</h3>
      <ul className="mt-2 space-y-1 text-sm">
        {(task.attachments ?? []).map((file) => (
          <li key={file.id}>
            <button className="text-moss" onClick={() => download(file.id, file.originalName)}>
              {file.originalName}
            </button>
            <span className="text-muted"> · {Math.ceil(file.size / 1024)} KB</span>
          </li>
        ))}
      </ul>
      {can(role, 'task.update') ? (
        <input
          className="mt-2 block text-sm"
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload.mutate(file);
          }}
        />
      ) : null}
      {upload.isError ? <Notice>{errorMessage(upload.error)}</Notice> : null}
    </section>
  );
}
