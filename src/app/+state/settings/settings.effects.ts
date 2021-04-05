import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { SettingsService } from './settings.service';
import * as SettingsActions from './settings.actions';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable()
export class SettingsEffects {
  constructor(
    private readonly actions$: Actions,
    private readonly settingsService: SettingsService
  ) {}

  loadSettings$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.loadSettings),
      mergeMap(() => {
        return this.settingsService.loadSettings().pipe(
          map((settings) => SettingsActions.loadSettingsSuccess({ settings })),
          catchError((error) =>
            of(SettingsActions.loadSettingsFailure({ error }))
          )
        );
      })
    )
  );

  saveSettings$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.saveSettings),
      mergeMap((action) =>
        this.settingsService.saveSettings(action.settings).pipe(
          map((result) => SettingsActions.saveSettingsSuccess({ result })),
          map(() => SettingsActions.loadSettings()),
          catchError((error) =>
            of(SettingsActions.saveSettingsFailure({ error }))
          )
        )
      )
    )
  );
}
