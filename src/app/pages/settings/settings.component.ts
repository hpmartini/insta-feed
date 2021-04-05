import { Component, OnInit } from '@angular/core';
import { FeedsService } from '../../+state/feeds/feeds.service';
import { SettingsFacade } from '../../+state/settings/settings.facade';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.sass'],
})
export class SettingsComponent implements OnInit {
  public speed = 30;
  public isSaving = false;

  constructor(
    private readonly feedService: FeedsService,
    private readonly settingsFacade: SettingsFacade
  ) {}

  ngOnInit(): void {
    this.settingsFacade.settings$.subscribe(
      (settings) => (this.speed = settings?.speed ?? this.speed)
    );

    this.feedService.savingSettings.subscribe(
      (isSaving) => (this.isSaving = isSaving)
    );
  }

  save(): void {
    if (this.isSaving) {
      return;
    }
    this.settingsFacade.saveSettings({ speed: this.speed });
  }
}
