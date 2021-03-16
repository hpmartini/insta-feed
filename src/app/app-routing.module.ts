import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { RowRunnerComponent } from './pages/row-runner/row-runner.component';
import { HomeComponent } from './pages/home/home.component';
import { ArticlesComponent } from './pages/articles/articles.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'article/:url', component: ArticlesComponent },
  { path: 'rowrunner/:url/:isAutostart', component: RowRunnerComponent },
  { path: 'rowrunner/:url', component: RowRunnerComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
