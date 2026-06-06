import { TaskKanbanBoardComponent } from '../../src/app/pages/tasks/components/task-kanban-board/task-kanban-board.component';
import { TaskService } from '../../src/app/services/task.service';
import { WebsocketService } from '../../src/app/services/websocket.service';
import { Priority, Task, TaskStatus } from '../../src/app/models/task.model';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { EMPTY, of } from 'rxjs';

const COLUMN_TITLES = ['To Do', 'In Progress', 'On Hold', 'In Review'];

describe('TaskKanbanBoardComponent', () => {
  let tasksForLoad: Task[] = [];

  const reloadBoard = () => {
    cy.get('@kanbanFixture').then((wrapper: unknown) => {
      const { component, fixture } = wrapper as {
        component: TaskKanbanBoardComponent;
        fixture: { detectChanges: () => void };
      };
      component.loadTasks();
      fixture.detectChanges();
    });
  };

  const waitForBoard = () => {
    cy.get('.kanban-board', { timeout: 10000 }).should('be.visible');
  };

  beforeEach(() => {
    localStorage.clear();
    tasksForLoad = [];

    const getTasksByProject = cy.stub().as('getTasksByProject').callsFake(() => of([...tasksForLoad]));
    const updateTaskStatus = cy.stub().as('updateTaskStatus').callsFake(() =>
      of({
        id: 1,
        title: 'Fix login bug',
        description: '',
        status: TaskStatus.IN_PROGRESS,
      } as Task),
    );

    cy.mount(TaskKanbanBoardComponent, {
      componentProperties: {
        projectId: 1,
      },
      providers: [
        provideAnimations(),
        provideRouter([]),
        MessageService,
        {
          provide: TaskService,
          useValue: {
            getTasksByProject,
            updateTaskStatus,
            refresh$: EMPTY,
          },
        },
        {
          provide: WebsocketService,
          useValue: {
            subscribeToProject: () => EMPTY,
            getTaskUpdates: () => EMPTY,
            getNotificationStream: () => EMPTY,
          },
        },
      ],
    }).then(({ component, fixture }) => {
      cy.wrap({ component, fixture }).as('kanbanFixture');
    });
  });

  /**
   * Scenario: tasks load for a project and the main workflow columns are shown.
   */
  it('should render the 4 Kanban columns', () => {
    // ARRANGE — mounted with projectId 1 and empty task list (default beforeEach)

    // ACT
    waitForBoard();

    // ASSERT
    COLUMN_TITLES.forEach((title) => {
      cy.get('.kanban-column .header-pill .title').contains(title).should('be.visible');
    });
    cy.get('@getTasksByProject').should('have.been.calledWith', 1);
  });

  /**
   * Scenario: one TODO task is returned from the API.
   * Verifies the card title appears in the To Do column.
   */
  it('should display a task card in the correct column', () => {
    // ARRANGE
    tasksForLoad = [
      {
        id: 1,
        title: 'Fix login bug',
        description: '',
        status: TaskStatus.TODO,
        priority: Priority.HIGH,
        collaborators: [],
      },
    ];
    reloadBoard();

    // ACT
    waitForBoard();

    // ASSERT
    cy.contains('.task-title', 'Fix login bug').should('be.visible');
    cy.get('.kanban-column.col-todo')
      .find('.task-card')
      .should('contain.text', 'Fix login bug');
  });

  /**
   * Scenario: the project has no tasks.
   * Verifies columns render and no task cards are present.
   */
  it('should show empty state when no tasks exist', () => {
    // ARRANGE — empty tasksForLoad from beforeEach

    // ACT
    waitForBoard();

    // ASSERT
    COLUMN_TITLES.forEach((title) => {
      cy.get('.kanban-column .header-pill .title').contains(title).should('be.visible');
    });
    cy.get('.task-card').should('not.exist');
  });

  /**
   * Scenario: assignee starts a TODO task (status moves to IN_PROGRESS).
   * Calls the public panel hook instead of CDK drag-drop, then asserts TaskService.updateTaskStatus.
   */
  it('should call status update API when task is moved between columns', () => {
    // ARRANGE
    const todoTask: Task = {
      id: 1,
      title: 'Fix login bug',
      description: '',
      status: TaskStatus.TODO,
      priority: Priority.HIGH,
      collaborators: [],
    };
    tasksForLoad = [todoTask];
    reloadBoard();
    waitForBoard();

    // ACT — programmatic status change (same path as “Start” in the details panel)
    cy.get('@kanbanFixture').then((wrapper: unknown) => {
      const { component } = wrapper as { component: TaskKanbanBoardComponent };
      component.requestStartFromPanel(todoTask);
    });

    // ASSERT
    cy.get('@updateTaskStatus').should('have.been.calledOnce');
    cy.get('@updateTaskStatus').then((stub: unknown) => {
      const call = (stub as sinon.SinonStub).firstCall;
      expect(call.args[0]).to.eq(1);
      expect(call.args[1]).to.deep.include({ status: TaskStatus.IN_PROGRESS });
    });
  });
});
