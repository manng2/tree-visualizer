import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  computed,
  signal
} from '@angular/core';

@Component({
  selector: '[node]',
  standalone: true,
  imports: [],
  templateUrl: './node.component.svg',
  styleUrl: './node.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodeComponent {
  // @HostListener('click')
  // onClick(): void {
  //   this.isSelected = !this.isSelected;
  // }

  // @HostListener('mousemove', ['$event'])
  // onMouseMove(e: MouseEvent): void {
  //   if (!this.isSelected) {
  //     return;
  //   }
  //   this.coorX.set(e.offsetX);
  //   this.coorY.set(e.offsetY);
  //   this.coorChanged.emit({ x: this.coorX(), y: this.coorY() });
  // }

  isSelected = false;
  coorX = signal(0);
  coorY = signal(0);
  translateXY = computed(() => {
    return `translate(${this.coorX()}, ${this.coorY()})`;
  });

  @Input({ required: true }) val!: number;
  @Input({ required: true }) set x(value: number) {
    this.coorX.set(value);
  }
  @Input({ required: true }) set y(value: number) {
    this.coorY.set(value);
  }

  @Output() coorChanged = new EventEmitter<{ x: number; y: number }>();
}
