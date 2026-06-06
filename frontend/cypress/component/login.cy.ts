import { Login } from '../../src/app/pages/login/login';
import { ApiService } from '../../src/app/services/api';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

describe('Login component', () => {
  let loginStub: ReturnType<typeof cy.stub>;
  let routerNavigateStub: ReturnType<typeof cy.stub>;

  beforeEach(() => {
    localStorage.clear();

    loginStub = cy.stub().as('apiLogin');
    routerNavigateStub = cy.stub().as('routerNavigate');

    cy.mount(Login, {
      providers: [
        provideAnimations(),
        MessageService,
        {
          provide: ApiService,
          useValue: {
            login: loginStub,
            getRole: () => null,
          },
        },
        { provide: Router, useValue: { navigate: routerNavigateStub } },
        {
          provide: Location,
          useValue: {
            path: () => '/login',
            replaceState: cy.stub(),
          },
        },
      ],
    });
  });

  /**
   * Verifies that submitting the form with empty fields shows a client-side validation error.
   */
  it('should show error message when fields are empty and login is clicked', () => {
    // ARRANGE — component mounted with empty username/password (default state)

    // ACT
    cy.get('button[type="submit"]').click();

    // ASSERT
    cy.get('p-message').should('contain.text', 'Please fill in all fields');
    cy.get('@apiLogin').should('not.have.been.called');
  });

  /**
   * Verifies that the Sign in button stays enabled once both required fields have values.
   */
  it('should enable the Sign in button when both fields are filled', () => {
    // ARRANGE
    cy.get('#username').type('user@taskflow.com');
    cy.get('#password').type('SecretPass123!');

    // ACT — no click needed; assert current button state

    // ASSERT
    cy.get('button[type="submit"]').should('not.be.disabled');
  });

  /**
   * Verifies that a successful ApiService.login() response stores the session and navigates by role.
   */
  it('should call api.login() and navigate to dashboard on success', () => {
    // ARRANGE
    loginStub.returns(
      of({
        token: 'fake-jwt',
        id: 1,
        email: 'user@taskflow.com',
        firstName: 'Syrine',
        lastName: 'Test',
        role: 'COLLABORATOR',
      }),
    );

    cy.get('#username').type('user@taskflow.com');
    cy.get('#password').type('SecretPass123!');

    // ACT
    cy.get('button[type="submit"]').click();

    // ASSERT
    cy.get('@apiLogin').should('have.been.calledOnceWith', 'user@taskflow.com', 'SecretPass123!');
    cy.get('@routerNavigate').should('have.been.calledWith', ['/dashboard/collab']);
    cy.wrap(null).then(() => {
      expect(localStorage.getItem('token')).to.eq('fake-jwt');
    });
  });

  /**
   * Verifies that a 401 error from ApiService.login() displays the invalid-credentials message.
   */
  it('should show error message on failed login (401)', () => {
    // ARRANGE
    loginStub.returns(throwError(() => ({ status: 401 })));

    cy.get('#username').type('user@taskflow.com');
    cy.get('#password').type('wrong-password');

    // ACT
    cy.get('button[type="submit"]').click();

    // ASSERT
    cy.get('p-message').should('contain.text', 'Invalid email or password');
    cy.get('button[type="submit"]').should('not.be.disabled');
  });
});
