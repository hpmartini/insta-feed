import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FeedObject } from '../../model/FeedObject';
import { ArticleService } from '../../services/article.service';

@Component({
  selector: 'app-articles',
  templateUrl: './articles.component.html',
  styleUrls: ['./articles.component.sass'],
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
