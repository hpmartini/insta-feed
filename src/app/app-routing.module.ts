import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { RowRunnerComponent } from './pages/row-runner/row-runner.component';
import {HomeComponent} from './pages/home/home.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'rowrunner/:url', component: RowRunnerComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
