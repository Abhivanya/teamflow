import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { Spinner } from './components/ui';
import { OrgProvider, useMe } from './hooks/org';
import { ForgotPage, LoginPage, RegisterPage, ResetPage, VerifyPage } from './pages/auth';
import { InvitePage } from './pages/InvitePage';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })));
const BoardPage = lazy(() => import('./pages/BoardPage').then((m) => ({ default: m.BoardPage })));
const MembersPage = lazy(() => import('./pages/MembersPage').then((m) => ({ default: m.MembersPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const SearchPage = lazy(() => import('./pages/SearchPage').then((m) => ({ default: m.SearchPage })));

function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Spinner label="Loading page" />}>{children}</Suspense>;
}

function RequireAuth() {
  const me = useMe();
  if (me.isLoading) return <div className="grid min-h-screen place-items-center"><Spinner label="Loading TeamFlow" /></div>;
  if (me.isError || !me.data) return <Navigate to="/login" replace />;
  return (
    <OrgProvider>
      <Outlet />
    </OrgProvider>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPage />} />
      <Route path="/reset-password" element={<ResetPage />} />
      <Route path="/verify-email" element={<VerifyPage />} />
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Page><DashboardPage /></Page>} />
          <Route path="/projects" element={<Page><ProjectsPage /></Page>} />
          <Route path="/projects/:projectId" element={<Page><BoardPage /></Page>} />
          <Route path="/members" element={<Page><MembersPage /></Page>} />
          <Route path="/settings" element={<Page><SettingsPage /></Page>} />
          <Route path="/search" element={<Page><SearchPage /></Page>} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
