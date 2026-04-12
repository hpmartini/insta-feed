// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import 'zone.js/testing';
import { getTestBed, TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { USE_EMULATOR as AUTH_EMULATOR } from '@angular/fire/compat/auth';
import { USE_EMULATOR as FIRESTORE_EMULATOR } from '@angular/fire/compat/firestore';
import { AngularFireModule } from '@angular/fire/compat';
import { environment } from './environments/environment';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);

beforeEach(() => {
  TestBed.configureTestingModule({
    imports: [AngularFireModule.initializeApp(environment.firebase)],
    providers: [
      provideAnimations(),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideMockStore({ initialState: {} }),
      { provide: MatDialogRef, useValue: {} },
      { provide: MAT_DIALOG_DATA, useValue: {} },
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of({ get: () => 'example.com' }),
        },
      }
    ],
  });
});

