
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { importProvidersFrom, isDevMode } from '@angular/core';
import { AppRoutingModule } from './app/app-routing.module';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { AngularFireModule } from '@angular/fire/compat';
import { environment } from './environments/environment';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FIREBASE_OPTIONS } from '@angular/fire/compat';
// Import reducers, effects, etc. as needed

if (environment.production) {
  // enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(
      BrowserAnimationsModule,
      AppRoutingModule,
      AngularFireModule.initializeApp(environment.firebase),
      StoreModule.forRoot({}), // Add reducers
      EffectsModule.forRoot([]) // Add effects
    ),
    { provide: FIREBASE_OPTIONS, useValue: environment.firebase }
  ]
}).catch(err => console.error(err));
