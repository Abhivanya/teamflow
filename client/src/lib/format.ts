import type { TaskStatus } from './types';

export const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  DONE: 'Done',
};

export const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

export function formatWhen(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function dateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

export function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function errorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { error?: { message?: string } } } }).response;
    return response?.data?.error?.message || 'Request failed';
  }
  return 'Something went wrong';
}
