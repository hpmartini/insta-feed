import { Component, OnInit } from '@angular/core';
import { FeedService } from '../../services/feed.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.sass'],
})
export class SettingsComponent implements OnInit {
  public speed = 30;
  public isSaving = false;

  constructor(private readonly feedService: FeedService) {}

  ngOnInit(): void {
    this.feedService.loadingSettings.subscribe(
      (settings) => (this.speed = settings?.speed ?? this.speed)
    );
    this.feedService.loadSettings();

    this.feedService.savingSettings.subscribe(
      (isSaving) => (this.isSaving = isSaving)
    );
  }

  save(): void {
    this.feedService.saveSettings({ speed: this.speed });
  }
}
