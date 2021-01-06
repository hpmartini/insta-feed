import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AngularFireModule } from '@angular/fire';
import { environment } from '../environments/environment';
import { RowRunnerComponent } from './row-runner/row-runner.component';
import { FeedService } from './services/feed.service';
import { ScraperService } from './services/scraper.service';
import { HttpClientModule } from '@angular/common/http';
import { AngularFireFunctionsModule } from '@angular/fire/functions';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { FlexModule } from '@angular/flex-layout';

@NgModule({
  declarations: [AppComponent, RowRunnerComponent],
  imports: [
    AngularFireModule.initializeApp(environment.firebase, 'ready'),
    AngularFireFunctionsModule,
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    CommonModule,
    MatButtonModule,
    MatButtonModule,
    FlexModule,
  ],
  providers: [FeedService, ScraperService],
  bootstrap: [AppComponent],
})
export class AppModule {}
