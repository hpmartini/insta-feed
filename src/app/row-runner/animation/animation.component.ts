import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { concatMap, delay, map } from 'rxjs/operators';
import { from, Observable, of, Subscription } from 'rxjs';

const Hypher = require('hypher');
const german = require('hyphenation-lang-de');
let hyphen = null;

@Component({
  selector: 'app-animation',
  templateUrl: './animation.component.html',
  styleUrls: ['./animation.component.sass'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnimationComponent implements OnDestroy, AfterViewInit {
  @ViewChild('rowRunner', { static: false }) rowRunner: ElementRef;

  @Input() inputText: string;
  @Input() speed: number;

  public output = '';

  private animation: Subscription;
  private lineBreak = '\n';

  constructor(private ref: ChangeDetectorRef) {
    hyphen = new Hypher(german);
  }

  ngAfterViewInit(): void {
    // const hyphenatedInput = this.inputText
    //   .split(' ')
    //   .map((word) => {
    //     return this.checkForHyphenation(word);
    //   })
    //   .join(' ');
    // this.output = '';
    // this.ref.detectChanges();

    this.animation = from(this.inputText.split(' '))
      .pipe(
        concatMap((word) => this.getWordWithDelayedCharacters(word)),
        delay(200)
      )
      .subscribe((char) => this.animate(char));
  }

  private checkForHyphenation(word: string): string {
    console.log(word);
    this.output += word.concat(' ');
    this.ref.detectChanges();
    if (this.isEndOFLineReached()) {
      return this.hyphenate(word);
    }
    return word;
  }

  /***
   * Creates a sequential list of Observables for each character
   * @param word The current word to be animated
   * @private
   */
  private getWordWithDelayedCharacters(word: string): Observable<string> {
    return of(word).pipe(
      concatMap((value) => this.checkForHyphenation(value)),
      concatMap((newWord) =>
        from(newWord).pipe(
          concatMap((char) => this.getCharacterWithDelay(char))
        )
      )
    );
  }

  private hyphenate(word: string): string {
    let resultWord = '';

    this.output = this.output.slice(0, -(word.length + 1));
    this.ref.detectChanges();

    const syllables: string[] = hyphen.hyphenate(word);

    if (syllables.length === 1) {
      resultWord = this.lineBreak.concat(word);
      this.output += resultWord;
      this.ref.detectChanges();
      return resultWord;
    }

    let hyphenatedWord = '';
    for (const syllable of syllables) {
      this.output += syllable.concat('-');
      this.ref.detectChanges();

      const index = syllables.indexOf(syllable);
      if (this.isEndOFLineReached()) {
        resultWord = hyphenatedWord.concat(
          index ? '-' : '',
          this.lineBreak,
          syllables.slice(index, syllables.length).join('')
        );
        this.output = this.output.slice(0, -(syllable.length + 1)).concat('-');
        this.ref.detectChanges();
        break;
      }

      this.output = this.output.slice(0, -1);
      this.ref.detectChanges();
      hyphenatedWord += syllable;
    }

    this.output += this.lineBreak;
    this.ref.detectChanges();

    return resultWord;
  }

  /***
   * Returns an Observable with delay of the current character
   * @param char The character to be animated
   * @private
   */
  private getCharacterWithDelay(char: string): Observable<string> {
    console.log(char);
    return of(char).pipe(delay(this.speed));
  }

  /***
   * Add the current character to the output anc clears it, if the end of the page is reached
   * @param char The current character
   * @private
   */
  private animate(char: string): void {
    this.placeCharacter(char);
    this.clearIfEndOfPage();
  }

  /***
   * Place a character and a caret in front of it to the output
   * @param char The current character
   * @private
   */
  private placeCharacter(char: string): void {
    // this.output = this.output.slice(0, this.isNewLine() ? -1 : -2);
    this.output = this.output.slice(0, -2);
    this.output += char.concat(' ▉');
    this.ref.detectChanges();

    // if (this.isEndOFLineReached()) {
    //   this.output = this.output.slice(0, -2);
    //   this.output += this.lineBreak.concat('⏎');
    //   this.ref.detectChanges();
    // }
  }

  private isNewLine(): boolean {
    return this.output.slice(-1) === '⏎';
  }

  /***
   * Check if the animation has reached the end of the line
   * @private
   */
  private isEndOFLineReached(): boolean {
    const element = this.rowRunner.nativeElement;
    return element.scrollWidth > element.clientWidth;
  }

  /***
   * Clear the animation output if the end of the page is reached
   * @private
   */
  private clearIfEndOfPage(): void {
    const documentElement = document.documentElement;
    if (documentElement.scrollHeight > documentElement.clientHeight) {
      this.output = '';
    }
  }

  /***
   * Stop the animation and clear the output
   */
  ngOnDestroy(): void {
    this.animation.unsubscribe();
    this.output = '';
  }
}
