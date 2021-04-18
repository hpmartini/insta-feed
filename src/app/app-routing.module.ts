import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RowRunnerComponent } from './pages/row-runner/row-runner.component';
import { HomeComponent } from './pages/home/home.component';
import { ArticlesComponent } from './pages/articles/articles.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: '', component: HomeComponent },
  {
    path: 'article/:url',
    component: ArticlesComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'rowrunner/:url/:isAutostart',
    component: RowRunnerComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'rowrunner/:url',
    component: RowRunnerComponent,
    canActivate: [AuthGuard],
  },
  { path: 'settings', component: SettingsComponent, canActivate: [AuthGuard] },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
