import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { Settings } from '../../model/settings';
import { Functions, httpsCallable } from '@angular/fire/functions';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly functions: Functions = inject(Functions);

  constructor() {}

  saveSettings(settings: Settings): Observable<any> {
    const saveSettingsFunc = httpsCallable(this.functions, 'saveSettings');
    return from(saveSettingsFunc({ ...settings })).pipe(map(res => res.data));
  }

  loadSettings(): Observable<any> {
    const loadSettingsFunc = httpsCallable(this.functions, 'loadSettings');
    return from(loadSettingsFunc(null)).pipe(map(res => res.data));
  }
}
