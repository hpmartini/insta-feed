import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/functions';
import { Article } from '../model/article';
import { FeedService } from '../services/feed.service';

@Component({
  selector: 'app-row-runner',
  templateUrl: './row-runner.component.html',
  styleUrls: ['./row-runner.component.sass'],
})
export class RowRunnerComponent implements OnInit {
  @ViewChild('dummyDiv', { static: false }) dummyDiv: ElementRef;

  private url = 'https://rss.sueddeutsche.de/rss/Topthemen';
  private speed = 20;

  public isRowRunnerActive = false;
  public article: Article;
  public textBuffer: string;

  constructor(
    private readonly functions: AngularFireFunctions,
    private readonly feedService: FeedService
  ) {}

  ngOnInit(): void {
    this.feedService.article.subscribe((article) => {
      this.article = article ?? null;
      this.textBuffer = article?.content;
    });
    this.feedService.getArticleByUrl(this.url);
  }

  toggleSrt(): void {
    if (this.isRowRunnerActive) {
      this.textBuffer = this.article.content;
      this.isRowRunnerActive = false;
      return;
    }

    this.isRowRunnerActive = true;
    this.textBuffer = '';

    const lines = this.splitIntoLines(
      this.dummyDiv.nativeElement,
      this.article.content
    );
    this.animate(lines);
  }

  private splitIntoLines(element, content): string[] {
    const lines: string[] = [];

    content.split(' ').reduce((pref: string, current: string) => {
      element.innerText = this.concatString(pref, element.innerText, current);

      if (element.scrollWidth > element.clientWidth) {
        lines.push(element.innerText);
        element.innerText = '';
        return current; // todo hyphenate and check again
      }
      return '';
    }, '');
    element.innerText = '';

    return lines;
  }

  private concatString(prev: string, dummy: string, current: string): string {
    if (prev) {
      return prev.concat(' ', dummy, ' ', current);
    } else {
      return dummy.concat(' ', current);
    }
  }

  private async animate(content: string[]): Promise<void> {
    for (const line of [...content]) {
      await this.animateLine(line);
    }
  }

  private async animateLine(line: string): Promise<void> {
    for (const char of [...line]) {
      await this.placeCharacter(char);
    }
  }

  private placeCharacter(char): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.textBuffer = this.textBuffer?.slice(0, -2);
        this.textBuffer += char;
        this.textBuffer += ' ▉';
        resolve();
      }, this.speed);
    });
  }
}
