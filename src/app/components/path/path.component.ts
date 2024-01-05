import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';

@Component({
  selector: '[path]',
  standalone: true,
  imports: [],
  templateUrl: './path.component.svg',
  styleUrl: './path.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PathComponent implements OnChanges {
  line = `M 0 0 L 0 0`;

  @Input({ required: true }) x1!: number;
  @Input({ required: true }) y1!: number;
  @Input({ required: true }) x2!: number;
  @Input({ required: true }) y2!: number;

  ngOnChanges(): void {
    this.line = `M ${this.x1} ${this.y1} L ${this.x2} ${this.y2}`;
  }
}
