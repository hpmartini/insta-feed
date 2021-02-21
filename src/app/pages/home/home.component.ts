import { Component, OnInit } from '@angular/core';
import {navEntries} from '../../nav/nav.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.sass']
})
export class HomeComponent implements OnInit {

  public navEntries = navEntries;

  constructor() { }

  ngOnInit(): void {
  }

}
