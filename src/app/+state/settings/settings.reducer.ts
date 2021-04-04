import { Action, createReducer, MetaReducer, on } from '@ngrx/store';
import { environment } from '../../../environments/environment';
import {
  loadSettings,
  loadSettingsFailure,
  loadSettingsSuccess,
} from './settings.actions';
import { Settings } from '../../model/settings';

export const settingsFeatureKey = 'settings';

export interface SettingsState {
  settings: Settings;
  isLoaded: boolean;
  error?: string | null;
}

export interface SettingsPartialState {
  readonly [settingsFeatureKey]: SettingsState;
}

export const initialState: SettingsState = {
  settings: {
    speed: 30,
  },
  isLoaded: false,
};

export const metaReducers: MetaReducer<SettingsState>[] = !environment.production
  ? []
  : [];

export const settingsReducer = createReducer(
  initialState,
  on(loadSettings, (state) => {
    console.log('reducer');
    return {
      ...state,
      isLoaded: false,
      error: null,
    };
  }),
  on(loadSettingsSuccess, (state, { settings }) => ({
    ...state,
    settings,
    isLoaded: true,
  })),
  on(loadSettingsFailure, (state, { error }) => ({
    ...state,
    error,
    isLoaded: true,
  }))
);

export function reducer(
  state: SettingsState | undefined,
  action: Action
): SettingsState {
  return settingsReducer(state, action);
}
