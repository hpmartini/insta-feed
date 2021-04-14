import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { AnimationActiveService } from '../../services/animation-active.service';
import { Feed } from '../../model/feed';
import { NavigationStart, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map, shareReplay, tap } from 'rxjs/operators';
import { FeedsFacade } from '../../+state/feeds/feeds.facade';
import { MatDialog } from '@angular/material/dialog';
import { EditFeedDialogComponent } from '../edit-feed-dialog/edit-feed-dialog.component';

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
  public currentPage: string;
  public feedForm = new FormGroup({
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
    private readonly router: Router,
    public readonly animationActiveService: AnimationActiveService,
    private readonly breakpointObserver: BreakpointObserver,
    private readonly feedsFacade: FeedsFacade,
    public dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.feedsFacade.feeds$.subscribe((feeds) => (this.navEntries = feeds));
    this.feedsFacade.isLoaded$.subscribe(
      (isLoaded) => (this.isNavEntriesLoaded = isLoaded)
    );

    this.handleRouterParameters();
  }

  addNewFeed(): void {
    const feed: Feed = {
      name: this.feedForm.value.name,
      url: this.feedForm.value.url,
    };

    this.feedsFacade.addFeed(feed);
    this.isAddMode = false;
    this.feedForm.reset();

    // todo show snackbar on success
  }

  deleteFeed(feed: Feed): void {
    // todo ask for confirmation
    this.feedsFacade.deleteFeed(feed);
    this.isEditMode = false;
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

  openEditDialog(feed: Feed): void {
    const dialogRef = this.dialog.open(EditFeedDialogComponent, {
      width: '250px',
      data: { feed },
      autoFocus: false,
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.isEditMode = false;
      }
    });
  }
}
