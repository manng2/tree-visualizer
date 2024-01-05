import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  signal,
} from '@angular/core';

@Component({
  selector: '[node]',
  standalone: true,
  imports: [],
  templateUrl: './node.component.svg',
  styleUrl: './node.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodeComponent implements OnChanges {
  translateXY = 'translate(0,0)';

  @Input({ required: true }) val!: number;
  @Input({ required: true }) x!: number;
  @Input({ required: true }) y!: number;

  ngOnChanges(): void {
    this.translateXY = `translate(${this.x},${this.y})`;
  }
}
