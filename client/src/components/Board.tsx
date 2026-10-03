import { DndContext, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation } from '@tanstack/react-query';
import { STATUS_LABEL, STATUSES, errorMessage, formatWhen, initials } from '../lib/format';
import { api } from '../lib/api';
import { queryClient } from '../lib/query';
import type { Task, TaskStatus } from '../lib/types';

export function Board({
  projectId,
  tasks,
  onOpen,
}: {
  projectId: string;
  tasks: Task[];
  onOpen: (id: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const move = useMutation({
    mutationFn: (input: { id: string; status: TaskStatus; updatedAt: string }) =>
      api.patch(`/tasks/${input.id}`, { status: input.status, updatedAt: input.updatedAt }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', projectId] });
      const previous = queryClient.getQueryData<Task[]>(['tasks', projectId]);
      queryClient.setQueryData<Task[]>(['tasks', projectId], (current) =>
        current?.map((task) => (task.id === input.id ? { ...task, status: input.status } : task)),
      );
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(['tasks', projectId], context.previous);
      window.alert(errorMessage(error));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  function onDragEnd(event: DragEndEvent) {
    const task = tasks.find((item) => item.id === String(event.active.id));
    const overId = event.over ? String(event.over.id) : '';
    if (!task || !overId) return;
    const overTask = tasks.find((item) => item.id === overId);
    const next = (STATUSES as string[]).includes(overId) ? (overId as TaskStatus) : overTask?.status;
    if (!next || next === task.status) return;
    move.mutate({ id: task.id, status: next, updatedAt: task.updatedAt });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid items-start gap-3 md:grid-cols-4">
        {STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={tasks.filter((task) => task.status === status)}
            onOpen={onOpen}
          />
        ))}
      </div>
    </DndContext>
  );
}

function Column({ status, tasks, onOpen }: { status: TaskStatus; tasks: Task[]; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section ref={setNodeRef} className={`rounded-xl bg-sidebar/80 p-2 ${isOver ? 'ring-2 ring-moss/40' : ''}`}>
      <header className="flex items-center justify-between px-2 py-2">
        <h2 className="text-sm font-medium">{STATUS_LABEL[status]}</h2>
        <span className="text-xs text-muted">{tasks.length}</span>
      </header>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {tasks.map((task) => (
            <Card key={task.id} task={task} onOpen={onOpen} />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

function Card({ task, onOpen }: { task: Task; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const overdue = Boolean(task.dueDate && task.status !== 'DONE' && new Date(task.dueDate) < new Date());
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.55 : 1 }}
      className="rounded-lg border border-line bg-card p-3"
    >
      <div className="flex items-start gap-2">
        <button className="flex-1 text-left text-sm font-medium" onClick={() => onOpen(task.id)}>
          {task.title}
        </button>
        <button className="cursor-grab px-1 text-xs text-muted" aria-label="Move task" {...attributes} {...listeners}>
          drag
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>{task.priority.toLowerCase()}</span>
        <span className={overdue ? 'text-clay' : ''}>{task.dueDate ? formatWhen(task.dueDate) : ''}</span>
        <span className="grid h-6 w-6 place-items-center rounded-full bg-sidebar text-[10px] font-medium text-ink">
          {initials(task.assignee?.name)}
        </span>
      </div>
    </article>
  );
}
