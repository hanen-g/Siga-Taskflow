import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Signup } from './pages/signup/signup';
import { DashboardRedirect } from './pages/redirect-dashboard';
import { PMDashboard } from './pages/pm_dashboard/dashboard';
import { CollabDashboard } from './pages/collab_dashboard/dashboard';
import { AuthGuard } from './guards/auth.guard';
import { CreateProject } from './pages/create-project/create-project';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'signup', component: Signup },
  { path: 'dashboard', component: DashboardRedirect, canActivate: [AuthGuard] },
  { path: 'dashboard/pm', component: PMDashboard, canActivate: [AuthGuard], data: { roles: ['PROJECT_MANAGER'] } },
  { path: 'dashboard/collab', component: CollabDashboard, canActivate: [AuthGuard], data: { roles: ['COLLABORATOR'] } },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {path: 'create-project',component: CreateProject}
];
