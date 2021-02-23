import { Component } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { FormControl, FormGroup } from '@angular/forms';
import { AnimationActiveService } from '../services/animation-active.service';
import { Feed } from '../model/feed';
import { FeedService } from '../services/feed.service';

@Component({
  selector: 'app-nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.sass'],
})
export class NavComponent {
  public navEntries: Feed[];
  public isEditMode = false;
  public isAddMode = false;
  public isNavEntriesLoaded = false;

  public newFeedForm = new FormGroup({
    name: new FormControl(''),
    url: new FormControl(''),
  });
  isHandset$: Observable<boolean> = this.breakpointObserver
    .observe(Breakpoints.Handset)
    .pipe(
      map((result) => result.matches),
      shareReplay()
    );

  constructor(
    private readonly breakpointObserver: BreakpointObserver,
    private readonly feedService: FeedService,
    public readonly animationActiveService: AnimationActiveService
  ) {
    this.feedService.feedList.subscribe((feedList) => {
      if (feedList?.length > 0) {
        this.navEntries = feedList;
        this.isNavEntriesLoaded = true;
      }
    });
    this.feedService.getFeedListFromFirestore();
  }

  addNewFeed(): void {
    const feed: Feed = {
      name: this.newFeedForm.value.name,
      url: this.newFeedForm.value.url,
    };

    this.feedService.addFeedToFirestore(feed);
    this.isAddMode = false;
    this.feedService.getFeedListFromFirestore();
    this.newFeedForm.reset();
  }

  removeFeed($event: MouseEvent): void {
    // todo
  }
}
