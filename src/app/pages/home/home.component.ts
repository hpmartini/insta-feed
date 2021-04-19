import { Component } from '@angular/core';
import { Feed } from '../../model/feed';
import { AuthService } from '../../services/auth.service';
import {
  LoginRegisterDialogComponent,
  LoginRegisterType,
} from '../../components/login-register-dialog/login-register-dialog.component';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.sass'],
})
export class HomeComponent {
  public navEntries: Feed[] = [
    {
      name: 'Süddeutsche',
      url: 'rss.sueddeutsche.de/rss/Topthemen',
      icon: 'panorama_photosphere',
    },
  ];

  constructor(
    public readonly authService: AuthService,
    private readonly dialog: MatDialog
  ) {}

  openLoginDialog(): void {
    this.dialog.open(LoginRegisterDialogComponent, {
      width: '423px',
      data: { type: LoginRegisterType.login },
      autoFocus: false,
    });
  }
}
