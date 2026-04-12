import * as fromSettings from './app/+state/settings/settings.reducer';
import { SettingsEffects } from './app/+state/settings/settings.effects';
import * as fromFeeds from './app/+state/feeds/feeds.reducer';
import { FeedsEffects } from './app/+state/feeds/feeds.effects';
import { enableProdMode, importProvidersFrom } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';


import { environment } from './environments/environment';
import { FeedsService } from './app/+state/feeds/feeds.service';
import { SettingsService } from './app/+state/settings/settings.service';
import { SettingsFacade } from './app/+state/settings/settings.facade';
import { ArticleService } from './app/services/article.service';
import { FeedsFacade } from './app/+state/feeds/feeds.facade';
import { provideAuth, getAuth, connectAuthEmulator } from '@angular/fire/auth';
import { provideFirestore, getFirestore, connectFirestoreEmulator } from '@angular/fire/firestore';
import { provideFunctions, getFunctions, connectFunctionsEmulator } from '@angular/fire/functions';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { AppRoutingModule } from './app/app-routing.module';
import { withInterceptorsFromDi, provideHttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { LayoutModule } from '@angular/cdk/layout';
import { provideAnimations } from '@angular/platform-browser/animations';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { AppComponent } from './app/app.component';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
    providers: [
        importProvidersFrom( BrowserModule, AppRoutingModule, CommonModule, LayoutModule, ReactiveFormsModule, FormsModule, StoreModule.forRoot({}), EffectsModule.forRoot([]), StoreModule.forFeature(fromSettings.settingsFeatureKey, fromSettings.reducer, { metaReducers: fromSettings.metaReducers }), EffectsModule.forFeature([SettingsEffects]), StoreModule.forFeature(fromFeeds.feedsFeatureKey, fromFeeds.reducer), EffectsModule.forFeature([FeedsEffects]), !environment.production ? StoreDevtoolsModule.instrument() : []),
        FeedsService,
        SettingsService,
        SettingsFacade,
        ArticleService,
        FeedsFacade,
        



        provideFirebaseApp(() => initializeApp(environment.firebase)),
        provideAuth(() => {
          const auth = getAuth();
          if (environment.stage === 'emulator') connectAuthEmulator(auth, 'http://localhost:9099');
          return auth;
        }),
        provideFirestore(() => {
          const firestore = getFirestore();
          if (environment.stage === 'emulator') connectFirestoreEmulator(firestore, 'localhost', 8080);
          return firestore;
        }),
        provideFunctions(() => {
          const functions = getFunctions();
          if (environment.stage === 'emulator') connectFunctionsEmulator(functions, 'localhost', 5001);
          return functions;
        }),
        provideHttpClient(withInterceptorsFromDi()),
        provideAnimations(),
    ]
})
  .catch(err => console.error(err));
