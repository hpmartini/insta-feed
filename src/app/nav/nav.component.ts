import { Component } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { FormControl, FormGroup } from '@angular/forms';
import { AnimationActiveService } from '../services/animation-active.service';
import { Feed } from '../model/feed';
import { FeedService } from '../services/feed.service';
import { NavigationStart, Router } from '@angular/router';

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
  public isHome = false;
  public isFeedListUpdating = false;

  public newFeedForm = new FormGroup({
    name: new FormControl(''),
    url: new FormControl(''),
  });
  public isHandset$: Observable<boolean> = this.breakpointObserver
    .observe(Breakpoints.Handset)
    .pipe(
      map((result) => result.matches),
      shareReplay()
    );
  public isTablet$: Observable<boolean> = this.breakpointObserver
    .observe(Breakpoints.Tablet)
    .pipe(
      map((result) => result.matches),
      shareReplay()
    );
  public currentPage: string;

  constructor(
    private readonly breakpointObserver: BreakpointObserver,
    private readonly feedService: FeedService,
    private readonly router: Router,
    public readonly animationActiveService: AnimationActiveService
  ) {
    this.feedService.feedList.subscribe((feedList) => {
      if (feedList?.length > 0) {
        this.navEntries = feedList;
        this.isNavEntriesLoaded = true;
      }
    });
    this.feedService.getFeedListFromFirestore();
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.isHome = event.url === '/';
        this.currentPage = event.url === '/' ? 'home' : '';
      }
    });
    this.feedService.updatingFeedList.subscribe(
      (updating) => (this.isFeedListUpdating = updating)
    );
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

    // todo show snackbar on success
  }

  deleteFeed(feedName: string): void {
    // todo ask for confirmation
    this.feedService.deleteFeed(feedName);
    this.isEditMode = false;
    const index = this.navEntries.findIndex((feed) => feed.name === feedName);
    this.navEntries.splice(index, 1);

    // todo show snackbar on success
  }

  toggleEditMode(): void {
    this.isEditMode = !this.isEditMode;
    this.isAddMode = false;
  }

  toggleAddMode(): void {
    this.isAddMode = !this.isAddMode;
    this.isEditMode = false;
  }
}
