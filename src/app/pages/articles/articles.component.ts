import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FeedObject } from '../../model/FeedObject';
import { ArticleService } from '../../services/article.service';
import { SpinnerComponent } from '../../components/spinner/spinner.component';
import { NgFor, DatePipe } from '@angular/common';
import { MatCard, MatCardHeader, MatCardContent, MatCardFooter, MatCardActions } from '@angular/material/card';
import { MatMiniFabButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

@Component({
    selector: 'app-articles',
    templateUrl: './articles.component.html',
    styleUrls: ['./articles.component.sass'],
    standalone: true,
    imports: [
        SpinnerComponent,
        NgFor,
        MatCard,
        MatCardHeader,
        RouterLink,
        MatCardContent,
        MatCardFooter,
        MatCardActions,
        MatMiniFabButton,
        MatIcon,
        DatePipe,
    ],
})
export class ArticlesComponent implements OnInit {
  public articleList: FeedObject[];

  constructor(
    private readonly articleService: ArticleService,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.articleService.articleList.subscribe((articles) => {
      return (this.articleList = articles ?? null);
    });
    this.route.paramMap.subscribe((route) => {
      const feedUrl = 'https://'.concat(route.get('url'));
      this.articleService.loadArticleList(feedUrl);
    });
  }
}
