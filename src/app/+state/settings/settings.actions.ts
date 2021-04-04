import { createAction, props } from '@ngrx/store';
import { Settings } from '../../model/settings';

const LOAD_SETTINGS = '[LoadSettings] Load LoadSettings';
const LOAD_SETTINGS_SUCCESS = '[LoadSettings] Load LoadSettings Success';
const LOAD_SETTINGS_ERROR = '[LoadSettings] Load LoadSettings Failure';

export const loadSettings = createAction(LOAD_SETTINGS);

export const loadSettingsSuccess = createAction(
  LOAD_SETTINGS_SUCCESS,
  props<{ settings: Settings }>()
);

export const loadSettingsFailure = createAction(
  LOAD_SETTINGS_ERROR,
  props<{ error: string }>()
);
