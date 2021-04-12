import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { AnimationActiveService } from '../services/animation-active.service';
import { Feed } from '../model/feed';
import { FeedsService } from '../+state/feeds/feeds.service';
import { NavigationStart, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map, shareReplay, tap } from 'rxjs/operators';
import { FeedsFacade } from '../+state/feeds/feeds.facade';

@Component({
  selector: 'app-nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.sass'],
})
export class NavComponent implements OnInit {
  public navEntries: Feed[];
  public isEditMode = false;
  public isAddMode = false;
  public isNavEntriesLoaded = false;
  public isHome = false;
  public isFeedListUpdating = false;
  public currentPage: string;
  public newFeedForm = new FormGroup({
    name: new FormControl(''),
    url: new FormControl(''),
  });
  public isHandset: boolean;
  public isHandset$: Observable<boolean> = this.breakpointObserver
    .observe(Breakpoints.Handset)
    .pipe(
      map((result) => result.matches),
      tap((result) => (this.isHandset = result)),
      shareReplay()
    );

  constructor(
    private readonly feedService: FeedsService,
    private readonly router: Router,
    public readonly animationActiveService: AnimationActiveService,
    private readonly breakpointObserver: BreakpointObserver,
    private readonly feedsFacade: FeedsFacade
  ) {}

  ngOnInit(): void {
    this.feedsFacade.feeds$.subscribe((feeds) => (this.navEntries = feeds));
    this.feedsFacade.isLoaded$.subscribe(
      (isLoaded) => (this.isNavEntriesLoaded = isLoaded)
    );

    this.feedService.updatingFeedList.subscribe(
      (updating) => (this.isFeedListUpdating = updating)
    );

    this.handleRouterParameters();
  }

  addNewFeed(): void {
    const feed: Feed = {
      name: this.newFeedForm.value.name,
      url: this.newFeedForm.value.url,
    };

    // this.feedService.addFeedToFirestore(feed);
    this.feedsFacade.addFeed(feed);
    this.isAddMode = false;
    this.feedsFacade.loadFeeds();
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

  private handleRouterParameters(): void {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.isHome = event.url === '/';
        this.currentPage = event.url === '/' ? 'home' : '';
      }
    });
  }
}
