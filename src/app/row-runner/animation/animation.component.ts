import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { concatMap, delay, map } from 'rxjs/operators';
import { from, Observable, of, Subscription } from 'rxjs';

@Component({
  selector: 'app-animation',
  templateUrl: './animation.component.html',
  styleUrls: ['./animation.component.sass'],
})
export class AnimationComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('rowRunner', { static: false }) rowRunner: ElementRef;

  @Input() lines: string;
  @Input() speed: number;

  public content;

  private animation: Subscription;

  ngAfterViewInit(): void {
    this.startAnimation();
  }

  ngOnInit(): void {}

  private startAnimation(): void {
    this.animation = from(this.lines.split(' '))
      .pipe(
        map((word) => {
          this.content += word;
          if (this.isEndOFLineReached()) {
            this.content.slice(0, -word.length);
            // todo: return hyphenated word
          }
          return word.concat(' ');
        }),
        // mergeMap((word) => from(word).pipe(delay(40))),
        concatMap((word) =>
          from(word).pipe(concatMap((char) => this.getCharDelayed(char)))
        )
      )
      .subscribe((char) => this.animate(char));
  }

  private getCharDelayed(char: string): Observable<string> {
    return of(char).pipe(delay(this.speed));
  }

  private animate(char: string): void {
    this.placeCharacter(char);
    this.clearIfEndOfPage();
  }

  private placeCharacter(char: string): void {
    this.content = this.content?.slice(0, -2);
    this.content += char;
    this.content += ' ▉';
    if (this.isEndOFLineReached()) {
      console.log('end of line');
      this.content = this.content.slice(0, -1);
      this.content += '&shy;';
      this.content += char;
    }
  }

  private isEndOFLineReached(): boolean {
    const element = this.rowRunner.nativeElement;
    return element.scrollWidth > element.clientWidth;
  }

  private clearIfEndOfPage(): void {
    const documentElement = document.documentElement;
    if (documentElement.scrollHeight > documentElement.clientHeight) {
      this.content = '';
    }
  }

  ngOnDestroy(): void {
    this.animation.unsubscribe();
  }
}
