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
import { concatMap, delay } from 'rxjs/operators';
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

  public output: string;

  private animation: Subscription;
  private lineBreak = '\n';
  private caret = '▉';

  constructor(private ref: ChangeDetectorRef) {
    hyphen = new Hypher(german);
    this.output = this.caret;
  }

  ngAfterViewInit(): void {
    this.animation = from(this.inputText.split(' '))
      .pipe(
        concatMap((word) => this.getWordWithDelayedCharacters(word)),
        delay(200)
      )
      .subscribe();
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
          concatMap((char) => of(this.animate(char)).pipe(delay(this.speed)))
        )
      )
    );
  }

  private checkForHyphenation(word: string): string {
    this.output = this.output.slice(0, -1);
    this.output += word;
    this.ref.detectChanges();
    if (this.isEndOFLineReached()) {
      const result = this.hyphenate(word);
      console.log(result);
      return result.concat(' ');
    }
    this.output = this.output.slice(0, -word.length);
    this.output += this.caret;
    this.ref.detectChanges();

    return word.concat(' ');
  }

  private hyphenate(word: string): string {
    let result = '';

    // remove word from output
    this.output = this.output.slice(0, -word.length);
    this.ref.detectChanges();

    // get syllables of word as array
    const syllables: string[] = hyphen.hyphenate(word);

    // if the word has only one syllable
    // return it and with a preceding linebreak
    if (syllables.length === 1) {
      result = this.lineBreak.concat(word);
      this.output += result;
      this.ref.detectChanges();
      return result;
    }

    let hyphenatedWord = '';
    // iterate through syllables
    for (const syllable of syllables) {
      // add a hyphen to simulate the resulting length
      this.output += syllable.concat('-');
      this.ref.detectChanges();

      const index = syllables.indexOf(syllable);
      // check if the end of the line is reached
      if (this.isEndOFLineReached()) {
        // combine the syllables left of the hyphen
        // with the syllables right of the hyphen
        result = hyphenatedWord.concat(
          index ? '-' : '',
          this.lineBreak,
          syllables.slice(index, syllables.length).join('')
        );
        // remove the tested syllables from the output
        this.output = this.output.slice(
          0,
          -(index ? hyphenatedWord.concat(syllable).length : syllable.length) -
            1
        );
        this.ref.detectChanges();

        // exit the loop
        break;
      }

      // remove the previously added hyphen
      this.output = this.output.slice(0, -1);
      this.ref.detectChanges();

      // save the current syllable
      hyphenatedWord += syllable;
    }

    this.output += this.lineBreak;
    this.ref.detectChanges();

    return result;
  }

  /***
   * Add the current character to the output anc clears it, if the end of the page is reached
   * @param char The current character
   * @private
   */
  private animate(char: string): string {
    this.placeCharacterAndCaret(char);
    this.clearIfEndOfPage();
    return char;
  }

  /***
   * Place a character and a caret in front of it to the output
   * @param char The current character
   * @private
   */
  private placeCharacterAndCaret(char: string): void {
    this.output = this.output.slice(0, -2);
    this.output += char.concat(' ', this.caret);
    this.ref.detectChanges();
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
