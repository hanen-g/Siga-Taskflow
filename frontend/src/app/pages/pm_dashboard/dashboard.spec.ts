import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PMDashboard } from './dashboard';

describe('PMDashboard', () => {
  let component: PMDashboard;
  let fixture: ComponentFixture<PMDashboard>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PMDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PMDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
