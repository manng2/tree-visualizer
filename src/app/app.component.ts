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
import { debounceTime, filter, map } from 'rxjs';
import { NodeSvg } from './models/node.svg.model';
import { Nullable } from './models/nullable.model';
import { PathSvg } from './models/path.svg.model';
import { TreeNode } from './models/tree-node.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, AfterViewInit {
  readonly document = inject(DOCUMENT);
  readonly DEFAULT_VALUE = '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15';
  readonly BASE_HORIZONTAL_DISTANCE_TO_ROOT = 150;

  arrAsString = new FormControl('');
  root: Nullable<TreeNode> = null;
  pathsSvg: WritableSignal<PathSvg[]> = signal([]);
  nodesSvg: WritableSignal<NodeSvg[]> = signal([]);
  panZoom: any;
  totalLevels = 0;

  @ViewChild('svg') svg!: ElementRef<SVGElement>;
  @ViewChild('gContainer') gContainer!: ElementRef<SVGGElement>;

  ngOnInit(): void {
    this.arrAsString.addValidators((control) => {
      try {
        let value = control.value;
        if (value[0] !== '[' && value[value.length - 1] !== ']') {
          value = `[${value}]`;
        }

        JSON.parse(value || '[]');
        return null;
      } catch (e) {
        return { invalidJson: true };
      }
    });

    this.arrAsString.valueChanges
      .pipe(
        debounceTime(400),
        filter(() => this.arrAsString.valid),
        map((it) => {
          if (!it) {
            return '[]';
          }

          if (it[0] !== '[' && it[it.length - 1] !== ']') {
            return `[${it}]`;
          }

          return it;
        }),
        map((it) => JSON.parse(it))
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

    this.arrAsString.setValue(this.DEFAULT_VALUE);
  }

  ngAfterViewInit(): void {
    this.panZoom = (window as any).panzoom(this.gContainer.nativeElement, {});
  }

  onCoorChanged({ x, y }: { x: number; y: number }, node: NodeSvg): void {
    const nodeIdx = this.nodesSvg().findIndex(
      (it) => it.x === node.x && it.y === node.y
    );

    this.nodesSvg.update((v) => {
      v[nodeIdx] = { ...v[nodeIdx], x, y };
      return v;
    });

    this.pathsSvg().forEach((path, idx) => {
      if (path.x1 === node.x && path.y1 === node.y) {
        this.pathsSvg.update((v) => {
          v[idx] = { ...v[idx], x1: x, y1: y };
          return v;
        });
      }
    });

    this.pathsSvg().forEach((path, idx) => {
      if (path.x2 === node.x && path.y2 === node.y) {
        this.pathsSvg.update((v) => {
          v[idx] = { ...v[idx], x2: x, y2: y };
          return v;
        });
      }
    });
  }

  private convertToTree(
    arr: Nullable<number>[],
    baseDistance = this.BASE_HORIZONTAL_DISTANCE_TO_ROOT
  ): TreeNode {
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
    this.totalLevels = 1;

    arr.forEach(() => {
      const leftVal = arr[lastCheckedIdx + 1];
      const rightVal = arr[lastCheckedIdx + 2];

      if (leftVal) {
        const left = {
          val: leftVal,
          left: null,
          right: null,
          x: 0,
          y: current.y + 100 - current.level * 5,
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
          x: 0,
          y: current.y + 100 - current.level * 5,
          level: current.level + 1,
        };

        current.right = right;
        arrNodes.push(right);
      }

      lastCheckedIdx += 2;

      current = arrNodes.shift() as TreeNode;
      this.totalLevels = current ? current.level : this.totalLevels;
    });

    return root;
  }

  private drawTree(
    node: Nullable<TreeNode>,
    prevSvgNode: Nullable<NodeSvg>,
    isFromLeft: boolean
  ): void {
    if (!node) {
      return;
    }

    const baseDistance = (this.totalLevels - node.level + 1) * 0;

    const x = !prevSvgNode
      ? node.x
      : node.x - (isFromLeft ? baseDistance : -baseDistance);
    const y = node.y;

    this.nodesSvg.update((v) => [...v, { val: node.val, x, y }]);

    if (node && prevSvgNode) {
      this.pathsSvg.update((v) => [
        ...v,
        { x1: x, y1: y, x2: prevSvgNode.x, y2: prevSvgNode.y },
      ]);
    }

    const lastSvgNode = this.nodesSvg()[this.nodesSvg().length - 1];
    this.drawTree(node.left, lastSvgNode, true);
    this.drawTree(node.right, lastSvgNode, false);
  }

  private checkOverlappingAndExtend(
    arr: Nullable<number>[],
    baseDistance = this.BASE_HORIZONTAL_DISTANCE_TO_ROOT
  ): void {
    const queue: TreeNode[] = [this.root!];
    const bfsNodes: TreeNode[] = [];

    while (queue.length) {
      const node = queue.shift()!;
      bfsNodes.push(node);
      const left = node.left;
      const right = node.right;

      if (left) {
        queue.push(left);
      }

      if (right) {
        queue.push(right);
      }
    }

    let isOverlapped = false;
    let overlappedLevel = 0;

    for (let i = 0; i < bfsNodes.length - 1; i++) {
      if (bfsNodes[i].level !== bfsNodes[i + 1].level) {
        continue;
      }

      if (bfsNodes[i].x + 20 > bfsNodes[i + 1].x - 20) {
        isOverlapped = true;
        overlappedLevel = bfsNodes[i].level;
        console.log('overlapped', bfsNodes[i].x, bfsNodes[i + 1].x);
        break;
      }

      if (i === bfsNodes.length - 2) {
        isOverlapped = false;
      }
    }

    if (isOverlapped) {
      // this.root = this.convertToTree(arr, baseDistance + 50);
      // this.extendDistanceBetweenNodes(overlappedLevel - 1, 30);
      // this.checkOverlappingAndExtend(arr, baseDistance + 50);
    }

    console.log(bfsNodes);
  }

  private extendDistanceBetweenNodes(
    toLevel: number,
    baseDistance: number
  ): void {
    const dfs = (node: Nullable<TreeNode>, isFromLeft: boolean) => {
      if (!node || node.level >= toLevel) {
        return;
      }

      if (node !== this.root) {
        console.log(node.val, node.x);
        node.x = isFromLeft ? node.x - baseDistance : node.x + baseDistance;
      }

      dfs(node.left, true);
      dfs(node.right, false);
    };

    dfs(this.root, true);
  }

  private setNodesCoordinates(): void {
    const queue: Nullable<TreeNode>[] = [this.root!];
    const bfsNodes: TreeNode[][] = [];

    while (queue.length) {
      const node = queue.shift()!;
      if (!node) {
        continue;
      }
      const left = node.left;
      const right = node.right;

      if (bfsNodes[node.level]) {
        bfsNodes[node.level].push(node);
      } else {
        bfsNodes[node.level] = [node];
      }
      queue.push(left);
      queue.push(right);
    }

    bfsNodes[bfsNodes.length - 1].forEach((it, idx) => {
      it.x = 100 + idx * 80;
    })

    const dfs = (node: Nullable<TreeNode>) => {
      if (!node) {
        return;
      }

      dfs(node.left);
      dfs(node.right);

      if (node.left && node.right) {
        node.x = (node.left.x + node.right.x) / 2;
      } else if (node.left) {
        node.x = node.left.x + 40;
      } else if (node.right) {
        node.x = node.right.x - 40;
      }
      console.log(node.val, node.x);
    };

    dfs(this.root);
  }

  private initRootAndDrawTree(arr: Nullable<number>[]): void {
    this.root = this.convertToTree(arr);
    if (!this.root) {
      return;
    }
    this.setNodesCoordinates();
    // this.checkOverlappingAndExtend(arr, this.BASE_HORIZONTAL_DISTANCE_TO_ROOT);
    this.drawTree(this.root, null, true);
  }

  private clearSvgData(): void {
    this.pathsSvg.set([]);
    this.nodesSvg.set([]);
  }
}
