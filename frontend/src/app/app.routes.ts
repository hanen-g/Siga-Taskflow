import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Signup } from './pages/signup/signup';
import { Dashboard } from './pages/dashboard/dashboard';
import { ProjectsPage } from './pages/project_manager/projects/projects';
import { AuthGuard } from './guards/auth.guard';
import { AppLayout } from './layout/app.layout';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  { path: 'login', component: Login },
  { path: 'signup', component: Signup },

  {
    path: '',
    component: AppLayout,
    canActivate: [AuthGuard],
    children: [
      {
        path: 'dashboard/pm',
        component: Dashboard,
        data: { roles: ['PROJECT_MANAGER'] }
      },
      {
        path: 'dashboard/pm/projects',
        component: ProjectsPage,
        data: { roles: ['PROJECT_MANAGER'] }
      },
      {
        path: 'dashboard/collab',
        component: Dashboard,
        data: { roles: ['COLLABORATOR'] }
      }
    ]
  },

  { path: '**', redirectTo: 'login' }
];
