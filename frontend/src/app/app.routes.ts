import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Signup } from './pages/signup/signup';
import { DashboardRedirect } from './pages/redirect-dashboard';
import { PMDashboard } from './pages/project_manager/dashboard';
import { CollabDashboard } from './pages/collaborator/dashboard';
import { CreateProject } from './pages/project_manager/create-project/create-project';
import { AuthGuard } from './guards/auth.guard';
import { AppLayout } from './layout/app.layout';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'signup', component: Signup },
  { path: 'dashboard', component: DashboardRedirect, canActivate: [AuthGuard] },

  {
    path: '',
    component: AppLayout,
    canActivate: [AuthGuard],
    children: [
      {
        path: 'dashboard/pm',
        component: PMDashboard,
        data: { roles: ['PROJECT_MANAGER'] }
      },
      {
        path: 'dashboard/pm/create-project',
        component: CreateProject,
        data: { roles: ['PROJECT_MANAGER'] }
      },
      {
        path: 'dashboard/collab',
        component: CollabDashboard,
        data: { roles: ['COLLABORATOR'] }
      }
    ]
  },

  { path: '', redirectTo: 'login', pathMatch: 'full' }
];
