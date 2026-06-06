import { AdminAiAssistantPage } from '../../src/app/pages/admin/ai-assistant/admin-ai-assistant';
import { AiChatService } from '../../src/app/services/ai-chat.service';
import type { AiChatApiResponse } from '../../src/app/models/ai-chat.model';
import { provideAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

const emptyChatResponse: AiChatApiResponse = {
  assistantMessage: '',
  actionType: 'ANSWER',
  results: [],
  resultCount: 0,
  suggestedFollowUps: [],
};

const OFF_TOPIC_CLIENT_REFUSAL =
  "I'm here to help with TaskFlow only. Please ask me something related to the app.";

describe('AdminAiAssistantPage', () => {
  let nextChatResponse: AiChatApiResponse = emptyChatResponse;

  const chatInput = () => cy.get('textarea.admin-ai-textarea');
  const sendButton = () => cy.get('.admin-ai-composer button[type="button"]');
  const conversationArea = () => cy.get('.admin-ai-chat-messages');

  beforeEach(() => {
    localStorage.clear();
    nextChatResponse = { ...emptyChatResponse };
    cy.viewport(1280, 900);

    cy.mount(AdminAiAssistantPage, {
      providers: [
        provideAnimations(),
        {
          provide: AiChatService,
          useValue: {
            preloadModel: () => of(undefined),
            chat: () => of(nextChatResponse),
          },
        },
      ],
    });
  });

  // Chat shell shows input, send control, and message scroll area on load.
  it('should render the chat interface correctly', () => {
    // ARRANGE — mounted with empty AI stubs (beforeEach)

    // ACT — no interaction

    // ASSERT
    chatInput().should('be.visible');
    sendButton().should('be.visible');
    conversationArea().should('be.visible');
  });

  // Send stays disabled until the user types non-whitespace text.
  it('should disable send button when input is empty', () => {
    // ARRANGE — mounted with empty input

    // ACT — no typing

    // ASSERT
    sendButton().should('be.disabled');
    chatInput().should('have.value', '');
  });

  // Submitting a question shows the user turn and the assistant reply from the API.
  it('should send a message and display the AI response', () => {
    // ARRANGE
    const userQuestion = 'Donne-moi la liste des projets en retard';
    const assistantReply = 'Voici la liste des projets en retard.';
    nextChatResponse = {
      assistantMessage: assistantReply,
      actionType: 'ANSWER',
      results: [],
      resultCount: 0,
      suggestedFollowUps: [],
    };

    // ACT
    chatInput().type(userQuestion);
    sendButton().should('not.be.disabled').click({ force: true });

    // ASSERT
    cy.get('.admin-ai-bubble.bubble-user', { timeout: 10000 })
      .should('be.visible')
      .and('contain.text', userQuestion);
    cy.get('.admin-ai-bubble.bubble-assistant', { timeout: 10000 })
      .should('be.visible')
      .and('contain.text', assistantReply);
  });

  // Off-topic prompts are refused without calling the AI chat endpoint.
  it('should show off-topic refusal message for unrelated questions', () => {
    // ARRANGE
    nextChatResponse = {
      assistantMessage: "I'm here to help with TaskFlow only.",
      actionType: 'CLARIFY',
      results: [],
      resultCount: 0,
    };

    // ACT
    chatInput().type('What is the weather today?');
    sendButton().should('not.be.disabled').click({ force: true });

    // ASSERT — client-side keyword guard (weather) shows the TaskFlow-only refusal
    cy.get('.admin-ai-bubble.bubble-assistant', { timeout: 10000 })
      .should('be.visible')
      .and('contain.text', OFF_TOPIC_CLIENT_REFUSAL);
  });
});
