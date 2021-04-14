import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Feed } from '../../model/feed';
import { FeedsFacade } from '../../+state/feeds/feeds.facade';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface FeedDialogData {
  feed: Feed;
}

@Component({
  selector: 'app-edit-feed-dialog',
  templateUrl: './edit-feed-dialog.component.html',
  styleUrls: ['./edit-feed-dialog.component.sass'],
})
export class EditFeedDialogComponent implements OnInit {
  public feedForm = new FormGroup({
    name: new FormControl(this.data.feed.name),
    url: new FormControl(this.data.feed.url),
  });

  constructor(
    private readonly feedsFacade: FeedsFacade,
    public dialogRef: MatDialogRef<EditFeedDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FeedDialogData
  ) {}

  ngOnInit(): void {}

  updateFeed(): void {
    const feed: Feed = {
      name: this.feedForm.value.name,
      url: this.feedForm.value.url,
    };
    if (this.isFeedUpdated(feed)) {
      this.feedsFacade.updateFeed(feed);
    }
    this.dialogRef.close(true);
  }

  close(): void {
    this.dialogRef.close();
  }

  private isFeedUpdated(newFeed: Feed): boolean {
    return (
      this.data.feed.name !== newFeed.name || this.data.feed.url !== newFeed.url
    );
  }
}
