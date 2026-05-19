import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Dashboard } from './pages/dashboard/dashboard';
import { ProjectsPage } from './pages/projects/projects';

import { AuthGuard } from './guards/auth.guard';
import { AppLayout } from './layout/app.layout';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  { path: 'login', component: Login },

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
          import('./pages/projects/project-detail').then(m => m.ProjectDetailPage),
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
          import('./pages/projects/project-detail').then(m => m.ProjectDetailPage),
        data: { roles: ['COLLABORATOR'] }
      },
      {
        path: 'dashboard/pm/archives',
        loadComponent: () => import('./pages/projects/archived-projects/archived-projects').then(m => m.ArchivedProjectsPage),
        data: { roles: ['PROJECT_MANAGER'] }
      },
      {
        path: 'dashboard/admin/archives',
        loadComponent: () => import('./pages/projects/archived-projects/archived-projects').then(m => m.ArchivedProjectsPage),
        data: { roles: ['ADMIN'], mode: 'archived' }
      },
      {
        path: 'dashboard/admin/delivered',
        loadComponent: () => import('./pages/projects/archived-projects/archived-projects').then(m => m.ArchivedProjectsPage),
        data: { roles: ['ADMIN'], mode: 'delivered' }
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
          import('./pages/projects/project-detail').then(m => m.ProjectDetailPage),
        data: { roles: ['CLIENT'] }
      },
      {
        path: 'dashboard/pm/tasks',
        loadComponent: () =>
          import('./pages/tasks/components/task-kanban-board/task-kanban-board.component').then(
            (m) => m.TaskKanbanBoardComponent
          ),
        data: { roles: ['PROJECT_MANAGER'] }
      },
      {
        path: 'dashboard/pm/task-reports',
        loadComponent: () => import('./pages/tasks/task-reports/task-reports').then(m => m.TaskReportsPage),
        data: { roles: ['PROJECT_MANAGER'] }
      },
      {
        path: 'dashboard/collab/tasks',
        loadComponent: () =>
          import('./pages/tasks/components/task-kanban-board/task-kanban-board.component').then(
            (m) => m.TaskKanbanBoardComponent
          ),
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
        path: 'dashboard/admin/advanced-filter',
        loadComponent: () =>
          import('./pages/admin/advanced-filtering/admin-advanced-filter').then((m) => m.AdminAdvancedFilterPage),
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'dashboard/admin/ai-chat',
        loadComponent: () =>
          import('./pages/admin/ai-assistant/admin-ai-assistant').then((m) => m.AdminAiAssistantPage),
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'dashboard/admin/create-client',
        loadComponent: () => import('./pages/admin/create-client/create-client').then(m => m.CreateClientPage),
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'dashboard/admin/projects/:projectId',
        loadComponent: () =>
          import('./pages/projects/project-detail').then(m => m.ProjectDetailPage),
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'dashboard/admin/projects',
        loadComponent: () => import('./pages/projects/projects').then(m => m.ProjectsPage),
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
        loadComponent: () =>
          import('./pages/tasks/components/task-kanban-board/task-kanban-board.component').then(
            (m) => m.TaskKanbanBoardComponent
          ),
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'dashboard/admin/users',
        loadComponent: () => import('./pages/admin/user-management/user-management').then(m => m.UserManagementPage),
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'dashboard/admin/create-users',
        loadComponent: () => import('./pages/admin/user-management/create-users/create-users').then(m => m.CreateUsersPage),
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'dashboard/admin/skills',
        loadComponent: () => import('./pages/admin/skills/admin-skills').then(m => m.AdminSkillsPage),
        data: { roles: ['ADMIN'] }
      }

    ]
  },

  { path: '**', redirectTo: 'login' }
];
