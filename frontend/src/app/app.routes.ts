import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Dashboard } from './pages/dashboard/dashboard';
import { ProjectsPage } from './pages/project_manager/projects/projects';
import { IAChatComponent } from './ia-dashbord/ia-chat.component';

import { AuthGuard } from './guards/auth.guard';
import { AppLayout } from './layout/app.layout';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  { path: 'login', component: Login },
  { path: 'signup', redirectTo: 'login', pathMatch: 'full' },

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
        path: 'dashboard/pm/projects/:projectId',
        loadComponent: () =>
          import('./pages/project_manager/projects/project-detail').then(m => m.ProjectDetailPage),
        data: { roles: ['PROJECT_MANAGER', 'COLLABORATOR'] }
      },
      {
        path: 'dashboard/pm/projects',
        component: ProjectsPage,
        data: { roles: ['PROJECT_MANAGER', 'COLLABORATOR'] }
      },
      {
        path: 'dashboard/collab/projects',
        component: ProjectsPage,
        data: { roles: ['COLLABORATOR'] }
      },
      {
        path: 'dashboard/collab/projects/:projectId',
        loadComponent: () =>
          import('./pages/project_manager/projects/project-detail').then(m => m.ProjectDetailPage),
        data: { roles: ['COLLABORATOR'] }
      },
      {
        path: 'dashboard/pm/archives',
        loadComponent: () => import('./pages/project_manager/archived-projects/archived-projects').then(m => m.ArchivedProjectsPage),
        data: { roles: ['PROJECT_MANAGER'] }
      },
      {
        path: 'dashboard/admin/archives',
        loadComponent: () => import('./pages/project_manager/archived-projects/archived-projects').then(m => m.ArchivedProjectsPage),
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'dashboard/collab',
        component: Dashboard,
        data: { roles: ['COLLABORATOR'] }
      },
      {
        path: 'dashboard/client',
        component: ProjectsPage,
        data: { roles: ['CLIENT'] }
      },
      {
        path: 'dashboard/client/projects/:projectId',
        loadComponent: () =>
          import('./pages/project_manager/projects/project-detail').then(m => m.ProjectDetailPage),
        data: { roles: ['CLIENT'] }
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
        data: { roles: ['PROJECT_MANAGER', 'COLLABORATOR', 'ADMIN', 'CLIENT'] }
      },
      {
        path: 'dashboard/admin',
        component: Dashboard,
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'dashboard/admin/projects/:projectId',
        loadComponent: () =>
          import('./pages/project_manager/projects/project-detail').then(m => m.ProjectDetailPage),
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'dashboard/admin/projects',
        loadComponent: () => import('./pages/project_manager/projects/projects').then(m => m.ProjectsPage),
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'dashboard/admin/project-proposals',
        loadComponent: () =>
          import('./pages/admin/project-proposals/project-proposals').then(m => m.ProjectProposalsPage),
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'dashboard/admin/tasks',
        loadComponent: () => import('./pages/tasks/tasks-page').then(m => m.TasksPage),
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'dashboard/admin/users',
        loadComponent: () => import('./pages/admin/user-management/user-management').then(m => m.UserManagementPage),
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'dashboard/admin/create-users',
        loadComponent: () => import('./pages/admin/create-users/create-users').then(m => m.CreateUsersPage),
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'dashboard/admin/skills',
        loadComponent: () => import('./pages/admin/skills/admin-skills').then(m => m.AdminSkillsPage),
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
