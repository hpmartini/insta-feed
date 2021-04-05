import { createAction, props } from '@ngrx/store';
import { Settings } from '../../model/settings';

const LOAD_SETTINGS = '[LoadSettings] Load LoadSettings';
const LOAD_SETTINGS_SUCCESS = '[LoadSettings] Load LoadSettings Success';
const LOAD_SETTINGS_ERROR = '[LoadSettings] Load LoadSettings Failure';

const SAVE_SETTINGS = '[SaveSettings] Save SaveSettings';
const SAVE_SETTINGS_SUCCESS = '[SaveSettings] Save SaveSettings Success';
const SAVE_SETTINGS_ERROR = '[SaveSettings] Save SaveSettings Failure';

export const loadSettings = createAction(LOAD_SETTINGS);

export const loadSettingsSuccess = createAction(
  LOAD_SETTINGS_SUCCESS,
  props<{ settings: Settings }>()
);

export const loadSettingsFailure = createAction(
  LOAD_SETTINGS_ERROR,
  props<{ error: string }>()
);

export const saveSettings = createAction(
  SAVE_SETTINGS,
  props<{ settings: Settings }>()
);

export const saveSettingsSuccess = createAction(
  SAVE_SETTINGS_SUCCESS,
  props<{ result: string }>()
);

export const saveSettingsFailure = createAction(
  SAVE_SETTINGS_ERROR,
  props<{ error: string }>()
);
