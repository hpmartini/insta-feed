import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { RowRunnerComponent } from './row-runner/row-runner.component';

const routes: Routes = [
  { path: '', redirectTo: '/', pathMatch: 'full'},
  { path: 'rowrunner', component: RowRunnerComponent}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
