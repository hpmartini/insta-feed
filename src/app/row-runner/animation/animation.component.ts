import { Component, Input, OnDestroy, OnInit } from '@angular/core';

@Component({
  selector: 'app-animation',
  templateUrl: './animation.component.html',
  styleUrls: ['./animation.component.sass'],
})
export class AnimationComponent implements OnInit, OnDestroy {
  @Input() lines: string[];
  @Input() speed: number;

  public content;

  private terminate = false;

  ngOnInit(): void {
    this.animate(this.lines).then(() => console.log('animation done'));
  }

  private async animate(content: string[]): Promise<void> {
    for (const line of [...content]) {
      await this.animateLine(line);
      const element = document.documentElement;
      if (element.scrollHeight > element.clientHeight) {
        this.content = '';
      }
      if (this.terminate) {
        break;
      }
    }
  }

  private async animateLine(line: string): Promise<void> {
    for (const char of [...line]) {
      await this.placeCharacter(char);
      if (this.terminate) {
        break;
      }
    }
  }

  private placeCharacter(char): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.content = this.content?.slice(0, -2);
        this.content += char;
        this.content += ' ▉';
        resolve();
      }, this.speed);
    });
  }

  ngOnDestroy(): void {
    this.terminate = true;
  }
}
