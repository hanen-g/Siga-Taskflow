import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CollabDashboard } from './dashboard';

describe('CollabDashboard', () => {
  let component: CollabDashboard;
  let fixture: ComponentFixture<CollabDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollabDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CollabDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
