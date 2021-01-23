import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { RowRunnerComponent } from './row-runner/row-runner.component';

const routes: Routes = [
  { path: '', redirectTo: 'rowrunner', pathMatch: 'full' },
  { path: 'rowrunner/:url', component: RowRunnerComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
