import { createAction, props } from '@ngrx/store';
import { Settings } from '../../model/settings';

const LOAD_SETTINGS = '[Facade oder save action] LoadSettings';
const LOAD_SETTINGS_SUCCESS = '[Facade oder save action] LoadSettings Success';
const LOAD_SETTINGS_ERROR = '[Facade oder save action] LoadSettings Failure';

const SAVE_SETTINGS = '[Settings page] SaveSettings';
const SAVE_SETTINGS_SUCCESS = '[Settings page] SaveSettings Success';
const SAVE_SETTINGS_ERROR = '[Settings page] SaveSettings Failure';

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
