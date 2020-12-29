import { Component, OnInit } from '@angular/core';
import { environment } from '../../environments/environment';
import { FeedService } from '../services/feed.service';
import { ScraperService } from '../services/scraper.service';
import { AngularFireFunctions } from '@angular/fire/functions';

@Component({
  selector: 'app-row-runner',
  templateUrl: './row-runner.component.html',
  styleUrls: ['./row-runner.component.sass'],
})
export class RowRunnerComponent implements OnInit {
  constructor(
    private readonly feedService: FeedService,
    private readonly scraperService: ScraperService
  ) {}
  private url = 'https://rss.sueddeutsche.de/rss/Topthemen';
  public data;

  private static getStartDelay(): number {
    let startDelay = 0;
    if (environment.production) {
      startDelay = 3000;
    }
    return startDelay;
  }

  ngOnInit(): void {
    this.feedService.getFeedContent(this.url).subscribe((value) => {
      const feed = this.feedService.extractFeeds(value);
      this.scraperService.scrapeTextFromHtml(feed).then((content) => {
        const options = {
          strings: [content],
          typeSpeed: 10,
          backSpeed: 40,
          showCursor: false,
          startDelay: RowRunnerComponent.getStartDelay(),
        };

        // return new Typed('#typed', options);
        return null;
      });
    });
  }
}
