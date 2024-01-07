import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  Output,
  computed,
  signal
} from '@angular/core';
import { Nullable } from 'src/app/models/nullable.model';

@Component({
  selector: '[node]',
  standalone: true,
  imports: [],
  templateUrl: './node.component.svg',
  styleUrl: './node.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodeComponent {
  @HostBinding('class.explored') get explored() {
    return this.status === 'explored';
  }
  @HostBinding('class.visited') get visited() {
    return this.status === 'visited';
  }

  coorX = signal(0);
  coorY = signal(0);
  translateXY = computed(() => {
    return `translate(${this.coorX()}, ${this.coorY()})`;
  });

  @Input({ required: true }) val!: Nullable<number>;
  @Input({ required: true }) set x(value: number) {
    this.coorX.set(value);
  }
  @Input({ required: true }) set y(value: number) {
    this.coorY.set(value);
  }
  @Input() status: 'explored' | 'visited' | 'unvisited' = 'unvisited';

  @Output() coorChanged = new EventEmitter<{ x: number; y: number }>();
}
