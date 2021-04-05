import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AngularFireModule } from '@angular/fire';
import { environment } from '../environments/environment';
import { RowRunnerComponent } from './pages/row-runner/row-runner.component';
import { FeedService } from './services/feed.service';
import { HttpClientModule } from '@angular/common/http';
import { AngularFireFunctionsModule } from '@angular/fire/functions';
import { CommonModule } from '@angular/common';
import { FlexLayoutModule, FlexModule } from '@angular/flex-layout';
import { AnimationComponent } from './pages/row-runner/animation/animation.component';
import { NavComponent } from './nav/nav.component';
import { LayoutModule } from '@angular/cdk/layout';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HomeComponent } from './pages/home/home.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SpinnerComponent } from './components/spinner/spinner.component';
import { ArticlesComponent } from './pages/articles/articles.component';
import { MaterialModule } from './material.module';
import { SettingsComponent } from './pages/settings/settings.component';
import { StoreModule } from '@ngrx/store';
import * as fromSettings from './+state/settings/settings.reducer';
import { EffectsModule } from '@ngrx/effects';
import { SettingsEffects } from './+state/settings/settings.effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { SettingsService } from './+state/settings/settings.service';
import { SettingsFacade } from './+state/settings/settings.facade';
import { BreakpointService } from './services/breakpoint.service';

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
  ],
  imports: [
    AngularFireModule.initializeApp(environment.firebase, 'ready'),
    AngularFireFunctionsModule,
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
    !environment.production ? StoreDevtoolsModule.instrument() : [],
  ],
  providers: [FeedService, SettingsService, SettingsFacade, BreakpointService],
  bootstrap: [AppComponent],
})
export class AppModule {}
