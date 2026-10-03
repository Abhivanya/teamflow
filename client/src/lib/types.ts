export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';

export type User = {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: string | null;
};

export type Org = {
  id: string;
  name: string;
  slug: string;
  role: Role;
  createdAt: string;
};

export type Person = { id: string; name: string; email?: string } | null;

export type Project = {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'archived';
  startDate: string | null;
  dueDate: string | null;
  members?: Member[];
  labels?: Label[];
};

export type Member = { userId: string; name: string; email: string; role?: Role; id?: string };

export type Label = { id: string; name: string; color: string };

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type Comment = {
  id: string;
  body: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  author: Person;
};

export type Activity = {
  id: string;
  type: string;
  text: string;
  actorName?: string;
  createdAt: string;
};

export type Attachment = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assignee: Person;
  reporter: Person;
  dueDate: string | null;
  labels: string[];
  position: number;
  createdAt: string;
  updatedAt: string;
  comments?: Comment[];
  activity?: Activity[];
  attachments?: Attachment[];
};

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
};

export type Dashboard = {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  openTasks: number;
  overdueTasks: number;
  tasksByStatus: { status: string; count: number }[];
  tasksByPriority: { priority: string; count: number }[];
  memberActivity: { name: string; count: number }[];
  projectProgress: { id: string; name: string; total: number; done: number; percent: number }[];
  recentActivity: Activity[];
  cached?: boolean;
};
