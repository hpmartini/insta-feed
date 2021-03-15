import { Component, OnInit } from '@angular/core';
import { FeedService } from '../../services/feed.service';
import { ActivatedRoute } from '@angular/router';
import { FeedObject } from '../../model/FeedObject';

@Component({
  selector: 'app-articles',
  templateUrl: './articles.component.html',
  styleUrls: ['./articles.component.sass'],
})
export class ArticlesComponent implements OnInit {
  public articleList: FeedObject[];

  constructor(
    private readonly feedService: FeedService,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.feedService.articleList.subscribe((articles) => {
      return (this.articleList = articles ?? null);
    });
    this.route.paramMap.subscribe((route) => {
      const feedUrl = 'https://'.concat(route.get('url'));
      this.feedService.loadArticleList(feedUrl);
    });
  }
}
