import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Settings } from '../../model/settings';
import { AngularFireFunctions } from '@angular/fire/functions';

@Injectable()
export class SettingsService {
  public savingSettings = new BehaviorSubject<boolean>(false);

  constructor(private readonly functions: AngularFireFunctions) {}

  saveSettings(settings: Settings): void {
    this.savingSettings.next(true);
    const settingsFunction = this.functions.httpsCallable('saveSettings');
    settingsFunction({ ...settings }).subscribe(() =>
      this.savingSettings.next(false)
    );
  }

  loadSettings(): Observable<any> {
    console.log('load settings');
    const settingsFunction = this.functions.httpsCallable('loadSettings');
    return settingsFunction(null);
  }
}