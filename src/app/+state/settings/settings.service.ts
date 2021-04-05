import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Settings } from '../../model/settings';
import { AngularFireFunctions } from '@angular/fire/functions';

@Injectable()
export class SettingsService {
  constructor(private readonly functions: AngularFireFunctions) {}

  saveSettings(settings: Settings): Observable<any> {
    return this.functions.httpsCallable('saveSettings')({ ...settings });
  }

  loadSettings(): Observable<any> {
    return this.functions.httpsCallable('loadSettings')(null);
  }
}
