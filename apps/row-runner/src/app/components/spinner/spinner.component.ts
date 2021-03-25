import { Component, Input } from '@angular/core';

@Component({
  selector: 'insta-feed-spinner',
  templateUrl: './spinner.component.html',
  styleUrls: ['./spinner.component.sass'],
})
export class SpinnerComponent {
  @Input() showSpinner = true;
  @Input() fullHeight = true;
}
