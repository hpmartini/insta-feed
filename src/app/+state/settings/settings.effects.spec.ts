import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Observable } from 'rxjs';

import { SettingsEffects } from './settings.effects';

describe('SettingsEffects', () => {
  const actions$: Observable<any> = null;
  let effects: SettingsEffects;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SettingsEffects, provideMockActions(() => actions$)],
    });

    effects = TestBed.inject(SettingsEffects);
  });

  it('should be created', () => {
    expect(effects).toBeTruthy();
  });
});
