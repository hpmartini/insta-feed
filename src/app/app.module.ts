import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AngularFireModule } from '@angular/fire';
import { environment } from '../environments/environment';
import { RowRunnerComponent } from './pages/row-runner/row-runner.component';
import { FeedsService } from './+state/feeds/feeds.service';
import { HttpClientModule } from '@angular/common/http';
import { AngularFireFunctionsModule } from '@angular/fire/functions';
import { CommonModule } from '@angular/common';
import { FlexLayoutModule, FlexModule } from '@angular/flex-layout';
import { AnimationComponent } from './pages/row-runner/animation/animation.component';
import { NavComponent } from './components/nav/nav.component';
import { LayoutModule } from '@angular/cdk/layout';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HomeComponent } from './pages/home/home.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SpinnerComponent } from './components/spinner/spinner.component';
import { ArticlesComponent } from './pages/articles/articles.component';
import { MaterialModule } from './material.module';
import { SettingsComponent } from './pages/settings/settings.component';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import * as fromSettings from './+state/settings/settings.reducer';
import * as fromFeeds from './+state/feeds/feeds.reducer';
import { SettingsEffects } from './+state/settings/settings.effects';
import { SettingsService } from './+state/settings/settings.service';
import { SettingsFacade } from './+state/settings/settings.facade';
import { FeedsFacade } from './+state/feeds/feeds.facade';
import { ArticleService } from './services/article.service';
import { FeedsEffects } from './+state/feeds/feeds.effects';
import { EditFeedDialogComponent } from './components/edit-feed-dialog/edit-feed-dialog.component';
import { LoginRegisterDialogComponent } from './components/login-register-dialog/login-register-dialog.component';
import {
  AngularFireAuth,
  AngularFireAuthModule,
  USE_EMULATOR,
} from '@angular/fire/auth';
import {
  USE_EMULATOR as FUNCTIONS_EMULATOR,
} from '@angular/fire/functions';
import { SETTINGS } from '@angular/fire/firestore';

@NgModule({
  declarations: [
    AppComponent,
    RowRunnerComponent,
    AnimationComponent,
    NavComponent,
    HomeComponent,
    SpinnerComponent,
    ArticlesComponent,
    SettingsComponent,
    EditFeedDialogComponent,
    LoginRegisterDialogComponent,
  ],
  imports: [
    AngularFireModule.initializeApp(environment.firebase, 'ready'),
    AngularFireFunctionsModule,
    AngularFireAuthModule,
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    CommonModule,
    FlexModule,
    FlexLayoutModule,
    LayoutModule,
    BrowserAnimationsModule,
    ReactiveFormsModule,
    MaterialModule,
    FormsModule,
    StoreModule.forRoot({}),
    EffectsModule.forRoot([]),
    StoreModule.forFeature(
      fromSettings.settingsFeatureKey,
      fromSettings.reducer,
      { metaReducers: fromSettings.metaReducers }
    ),
    EffectsModule.forFeature([SettingsEffects]),
    StoreModule.forFeature(fromFeeds.feedsFeatureKey, fromFeeds.reducer),
    EffectsModule.forFeature([FeedsEffects]),
    !environment.production ? StoreDevtoolsModule.instrument() : [],
  ],
  providers: [
    FeedsService,
    SettingsService,
    SettingsFacade,
    ArticleService,
    FeedsFacade,
    AngularFireAuth,
    {
      provide: SETTINGS,
      useValue:
        environment.stage === 'emulator'
          ? {
              host: 'localhost:8080',
              ssl: false,
            }
          : undefined,
    },
    {
      provide: USE_EMULATOR,
      useValue:
        environment.stage === 'emulator' ? ['localhost', 9099] : undefined,
    },
    {
      provide: FUNCTIONS_EMULATOR,
      useValue: environment.stage === 'emulator' ? ['localhost', 5001] : undefined,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
