import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TaskKanbanBoardComponent } from './components/task-kanban-board/task-kanban-board.component';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<app-task-kanban-board />',
  imports: [TaskKanbanBoardComponent]
})
export class TasksPage {}
