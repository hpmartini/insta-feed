import { Injectable } from '@angular/core';
import { select, Store } from '@ngrx/store';
import * as fromSettings from './settings.reducer';
import * as fromSettingsActions from './settings.actions';
import * as fromSettingsSelectors from './settings.selectors';

@Injectable()
export class SettingsFacade {
  settings$ = this.store.pipe(select(fromSettingsSelectors.getAllSettings));
  isLoaded$ = this.store.pipe(
    select(fromSettingsSelectors.getSettingsIsLoaded)
  );
  error$ = this.store.pipe(select(fromSettingsSelectors.getSettingsError));

  constructor(
    private readonly store: Store<fromSettings.SettingsPartialState>
  ) {}

  loadSettings(): void {
    console.log('facade');
    this.store.dispatch(fromSettingsActions.loadSettings());
  }
}
