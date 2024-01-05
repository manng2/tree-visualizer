import { DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  WritableSignal,
  inject,
  signal,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { catchError, debounceTime, map, of } from 'rxjs';
import { NodeSvg } from './models/node.svg.model';
import { PathSvg } from './models/path.svg.model';
import { Nullable } from './models/nullable.model';
import { TreeNode } from './models/tree-node.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, AfterViewInit {
  readonly document = inject(DOCUMENT);

  arrAsString = new FormControl('[1,2,null,4,5,6,7]');
  root: Nullable<TreeNode> = null;
  pathsSvg: WritableSignal<PathSvg[]> = signal([]);
  nodesSvg: WritableSignal<NodeSvg[]> = signal([]);

  @ViewChild('svg') svg!: ElementRef<SVGElement>;

  ngOnInit(): void {
    this.arrAsString.addValidators((control) => {
      try {
        JSON.parse(control.value || '[]');
        return null;
      } catch (e) {
        return { invalidJson: true };
      }
    });

    this.arrAsString.valueChanges
      .pipe(
        debounceTime(400),
        map((it) => JSON.parse(it || '[]')),
        catchError(() => of([]))
      )
      .subscribe({
        next: (value) => {
          this.clearSvgData();

          if (!value.length) {
            return;
          }

          this.initRootAndDrawTree(value);
        },
      });
  }

  ngAfterViewInit(): void {
    this.initRootAndDrawTree(JSON.parse(this.arrAsString.value || '[]'));
  }

  private convertToTree(arr: Nullable<number>[]): TreeNode {
    const root: TreeNode = {
      val: arr[0]!,
      left: null,
      right: null,
      x: this.svg.nativeElement.clientWidth / 2,
      y: 100,
      level: 1,
    };

    let lastCheckedIdx = 0;
    const arrNodes: TreeNode[] = [];
    let current: TreeNode = root;
    let totalLevel = 1;

    arr.forEach(() => {
      const leftVal = arr[lastCheckedIdx + 1];
      const rightVal = arr[lastCheckedIdx + 2];

      if (leftVal) {
        const left = {
          val: leftVal,
          left: null,
          right: null,
          x: current.x - 100 / current.level,
          y: current.y + 100,
          level: current.level + 1,
        };

        current.left = left;
        arrNodes.push(left);
      }

      if (rightVal) {
        const right = {
          val: rightVal,
          left: null,
          right: null,
          x: current.x + 100 / current.level,
          y: current.y + 100,
          level: current.level + 1,
        };

        current.right = right;
        arrNodes.push(right);
      }

      lastCheckedIdx += 2;

      current = arrNodes.shift() as TreeNode;
      totalLevel = current ? current.level : totalLevel;
    });

    return root;
  }

  private drawTree(node: Nullable<TreeNode>, prev: Nullable<TreeNode>): void {
    if (!node) {
      return;
    }

    this.nodesSvg.update((v) => [
      ...v,
      { val: node.val, x: node.x, y: node.y },
    ]);

    if (node && prev) {
      this.pathsSvg.update((v) => [
        ...v,
        { x1: node.x, y1: node.y, x2: prev.x, y2: prev.y },
      ]);
    }

    this.drawTree(node.left, node);
    this.drawTree(node.right, node);
  }

  private initRootAndDrawTree(arr: Nullable<number>[]): void {
    this.root = this.convertToTree(arr);
    if (!this.root) {
      return;
    }
    this.drawTree(this.root, null);
  }

  private clearSvgData(): void {
    this.pathsSvg.set([]);
    this.nodesSvg.set([]);
  }
}
