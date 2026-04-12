import { Component, Input } from '@angular/core';
import { NgIf, NgClass } from '@angular/common';

@Component({
    selector: 'app-spinner',
    templateUrl: './spinner.component.html',
    styleUrls: ['./spinner.component.sass'],
    standalone: true,
    imports: [NgIf, NgClass],
})
export class SpinnerComponent {
  @Input() showSpinner = true;
  @Input() fullHeight = true;
}
