import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';

import { RowRunnerComponent } from './row-runner.component';

describe('RowRunnerComponent', () => {
  let component: RowRunnerComponent;
  let fixture: ComponentFixture<RowRunnerComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [RowRunnerComponent]
})
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RowRunnerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
