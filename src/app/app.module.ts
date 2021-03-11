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
import { ReactiveFormsModule } from '@angular/forms';
import { SpinnerComponent } from './components/spinner/spinner.component';
import { ArticlesComponent } from './pages/articles/articles.component';
import { MaterialModule } from './material.module';

@NgModule({
  declarations: [
    AppComponent,
    RowRunnerComponent,
    AnimationComponent,
    NavComponent,
    HomeComponent,
    SpinnerComponent,
    ArticlesComponent,
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
  ],
  providers: [FeedService],
  bootstrap: [AppComponent],
})
export class AppModule {}
