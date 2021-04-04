import { createFeatureSelector, createSelector } from '@ngrx/store';
import {
  settingsFeatureKey,
  SettingsPartialState,
  SettingsState,
} from './settings.reducer';

export const getSettingsState = createFeatureSelector<
  SettingsPartialState,
  SettingsState
>(settingsFeatureKey);

export const getSettingsIsLoaded = createSelector(
  getSettingsState,
  (state: SettingsState) => state.isLoaded
);

export const getSettingsError = createSelector(
  getSettingsState,
  (state: SettingsState) => state.error
);

export const getAllSettings = createSelector(
  getSettingsState,
  (state: SettingsState) => state.settings
);
