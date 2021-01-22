import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { concatMap, delay } from 'rxjs/operators';
import { from, of, Subscription } from 'rxjs';

@Component({
  selector: 'app-animation',
  templateUrl: './animation.component.html',
  styleUrls: ['./animation.component.sass'],
})
export class AnimationComponent implements OnInit, OnDestroy {
  @ViewChild('rowRunner', { static: false }) rowRunner: ElementRef;

  @Input() lines: string;
  @Input() speed: number;

  public content;

  private obs: Subscription;

  ngOnInit(): void {
    this.obs = from(this.lines)
      .pipe(concatMap((x) => of(x).pipe(delay(this.speed))))
      .subscribe((char) => {
        this.placeCharacter(char);
        console.log('scrollHeight', this.rowRunner.nativeElement.scrollHeight);
        console.log('clientHeight', this.rowRunner.nativeElement.clientHeight);
        if (
          this.rowRunner.nativeElement.scrollHeight >
          this.rowRunner.nativeElement.clientHeight
        ) {
          this.content = '';
        }
      });
  }

  private placeCharacter(char: string): void {
    // this.content = this.content?.slice(0, -2);
    this.content += char;
    // this.content += ' ▉';
    if (this.isEndOFLineReached(this.rowRunner.nativeElement)) {
      console.log('end of line');
      this.content = this.content.slice(0, -1);
      this.content += '&shy;';
      this.content += char;
    }
  }

  ngOnDestroy(): void {
    this.obs.unsubscribe();
  }

  private isEndOFLineReached(element): boolean {
    console.log('check for line break');
    return element.scrollWidth > element.clientWidth;
  }
}
