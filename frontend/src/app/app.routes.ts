import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Signup } from './pages/signup/signup';
import { Dashboard } from './pages/dashboard/dashboard';
import { ProjectsPage } from './pages/project_manager/projects/projects';
import { IAChatComponent } from './ia-dashbord/ia-chat.component';

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
        path: 'dashboard/pm/archives',
        loadComponent: () => import('./pages/project_manager/archived-projects/archived-projects').then(m => m.ArchivedProjectsPage),
        data: { roles: ['PROJECT_MANAGER'] }
      },
      {
        path: 'dashboard/collab',
        component: Dashboard,
        data: { roles: ['COLLABORATOR'] }
      },
      {
        path: 'dashboard/pm/tasks',
        loadComponent: () => import('./pages/tasks/tasks-page').then(m => m.TasksPage),
        data: { roles: ['PROJECT_MANAGER'] }
      },
      {
        path: 'dashboard/pm/ia-chat',
        component: IAChatComponent,
        data: { roles: ['PROJECT_MANAGER'] }
      },
      {
        path: 'dashboard/collab/tasks',
        loadComponent: () => import('./pages/tasks/tasks-page').then(m => m.TasksPage),
        data: { roles: ['COLLABORATOR'] }
      },
      {
        path: 'dashboard/collab/ia-chat',
        component: IAChatComponent,
        data: { roles: ['COLLABORATOR'] }
      },
      {
        path: 'dashboard/profile',
        loadComponent: () => import('./pages/profile/profile').then(m => m.ProfilePage),
        data: { roles: ['PROJECT_MANAGER', 'COLLABORATOR', 'ADMIN'] }
      },
      {
        path: 'dashboard/admin',
        component: Dashboard,
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'dashboard/admin/projects',
        loadComponent: () => import('./pages/project_manager/projects/projects').then(m => m.ProjectsPage),
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'dashboard/admin/tasks',
        loadComponent: () => import('./pages/tasks/tasks-page').then(m => m.TasksPage),
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'dashboard/admin/ia-chat',
        component: IAChatComponent,
        data: { roles: ['ADMIN'] }
      }

    ]
  },

  { path: '**', redirectTo: 'login' }
];
