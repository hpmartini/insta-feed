import { Component, OnInit } from '@angular/core';
import { environment } from '../../environments/environment';
import { AngularFireFunctions } from '@angular/fire/functions';

@Component({
  selector: 'app-row-runner',
  templateUrl: './row-runner.component.html',
  styleUrls: ['./row-runner.component.sass'],
})
export class RowRunnerComponent implements OnInit {
  constructor(
    // private readonly feedService: FeedService,
    // private readonly scraperService: ScraperService,
    private readonly functions: AngularFireFunctions
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
    console.log('getting feed');
    const getFeed = this.functions.httpsCallable('getFeed');
    getFeed({ url: this.url }).subscribe((result) => {
      console.log(result);
      const getArticle = this.functions.httpsCallable('getArticle');
      getArticle({ url: result.items[0].link }).subscribe((result) =>
        console.log(result)
      );
    });

    // this.feedService.getFeedContent(this.url).subscribe((value) => {
    //   const feed = this.feedService.extractFeeds(value);
    //   this.scraperService.scrapeTextFromHtml(feed).then((content) => {
    //     const options = {
    //       strings: [content],
    //       typeSpeed: 10,
    //       backSpeed: 40,
    //       showCursor: false,
    //       startDelay: RowRunnerComponent.getStartDelay(),
    //     };
    //
    //     // return new Typed('#typed', options);
    //     return null;
    //   });
    // });
  }
}
