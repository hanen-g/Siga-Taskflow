import { ProjectsPage } from '../../src/app/pages/projects/projects';
import { ApiService } from '../../src/app/services/api';
import { ProjectService } from '../../src/app/services/project.service';
import { WebsocketService } from '../../src/app/services/websocket.service';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { EMPTY, of } from 'rxjs';

describe('Project proposal dialog (ProjectsPage)', () => {
  const proposalDialogTitle = 'Propose new project idea';

  const openProposeDialog = () => {
    cy.get('@projectsFixture').then((wrapper: unknown) => {
      const { component, fixture } = wrapper as {
        component: ProjectsPage;
        fixture: { detectChanges: () => void };
      };
      component.displayProposeDialog = true;
      fixture.detectChanges();
    });
  };

  beforeEach(() => {
    localStorage.clear();

    const submitProjectProposalStub = cy.stub().as('submitProjectProposal').returns(of({ id: 1 }));

    cy.mount(ProjectsPage, {
      providers: [
        provideAnimations(),
        provideRouter([]),
        MessageService,
        {
          provide: ApiService,
          useValue: {
            getResolvedRole: () => 'COLLABORATOR',
            getRole: () => 'COLLABORATOR',
          },
        },
        {
          provide: ProjectService,
          useValue: {
            myProjects: cy.stub().returns(of([])),
            getAllProjects: cy.stub().returns(of([])),
            listProposals: cy.stub().returns(of([])),
            submitProjectProposal: submitProjectProposalStub,
          },
        },
        {
          provide: WebsocketService,
          useValue: {
            getProjectUpdates: () => EMPTY,
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({}) },
            queryParamMap: of(convertToParamMap({})),
          },
        },
        { provide: Router, useValue: { navigate: cy.stub() } },
      ],
    }).then(({ component, fixture }) => {
      cy.wrap({ component, fixture }).as('projectsFixture');
    });
  });

  /**
   * Scenario: collaborator clicks “Propose new project idea” and the modal opens.
   */
  it('should show the proposal dialog when propose button is clicked', () => {
    // ARRANGE — component mounted with empty project list

    // ACT
    cy.contains('button', 'Propose new project idea', { timeout: 10000 }).should('be.visible').click();

    // ASSERT
    cy.get('.p-dialog').should('be.visible');
    cy.contains('.p-dialog-title', proposalDialogTitle).should('be.visible');
  });

  /**
   * Scenario: with the dialog open and empty fields, submit stays disabled until the user fills the form.
   */
  it('should disable submit button when required fields are empty', () => {
    // ARRANGE
    openProposeDialog();

    // ACT — no input yet

    // ASSERT
    cy.contains('button', 'Submit idea').should('be.disabled');
    cy.get('input[placeholder="Name for your project idea"]').should('have.value', '');
    cy.get('textarea[placeholder="Describe the goals"]').should('have.value', '');
  });

  /**
   * Scenario: filled proposal form calls ProjectService.submitProjectProposal with the entered payload.
   */
  it('should call submitProposal() when form is filled and submitted', () => {
    // ARRANGE
    openProposeDialog();

    const title = 'Mobile app redesign';
    const description = 'Refresh the client portal UI and navigation.';

    // ACT
    cy.get('input[placeholder="Name for your project idea"]').type(title);
    cy.get('textarea[placeholder="Describe the goals"]').type(description);
    cy.contains('button', 'Submit idea').should('not.be.disabled').click();

    // ASSERT
    cy.get('@submitProjectProposal').should('have.been.calledOnce');
    cy.get('@submitProjectProposal').then((stub: unknown) => {
      const body = (stub as sinon.SinonStub).firstCall.args[0] as {
        name: string;
        description: string;
        clientContact?: string | null;
      };
      expect(body.name).to.eq(title);
      expect(body.description).to.eq(description);
      expect(body.clientContact == null).to.be.true;
    });
  });

  /**
   * Scenario: successful submission shows a toast and closes the proposal dialog.
   */
  it('should show success message after successful proposal submission', () => {
    // ARRANGE
    openProposeDialog();

    // ACT
    cy.get('input[placeholder="Name for your project idea"]').type('Analytics dashboard');
    cy.get('textarea[placeholder="Describe the goals"]').type('KPIs for project managers.');
    cy.contains('button', 'Submit idea').click();

    // ASSERT
    cy.get('.p-toast-message-success', { timeout: 10000 }).should('be.visible');
    cy.get('.p-toast-summary').should('contain.text', 'Submitted');
    cy.get('.p-toast-detail').should(
      'contain.text',
      'Your project idea was sent to the administrator for review.',
    );
    cy.contains('.p-dialog-title', proposalDialogTitle).should('not.exist');
  });
});
