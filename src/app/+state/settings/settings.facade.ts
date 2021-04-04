import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import * as fromSettings from './settings.reducer';
import * as fromSettingsActions from './settings.actions';

@Injectable()
export class SettingsFacade {
  constructor(private readonly store: Store<fromSettings.SettingsState>) {}

  loadSettings(): void {
    console.log('facade');
    this.store.dispatch(fromSettingsActions.loadSettings());
  }
}
