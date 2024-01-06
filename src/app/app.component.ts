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
  readonly DEFAULT_VALUE = '1,2,3,4,5,6';
  readonly BASE_HORIZONTAL_DISTANCE_TO_ROOT = 150;

  arrAsString = new FormControl('');
  root!: TreeNode;
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

      lastCheckedIdx += 2;

      current = arrNodes.shift() as TreeNode;
      this.totalLevels = current ? current.level : this.totalLevels;
    });

    return root;
  }

  private drawTree(
    node: TreeNode,
    prevSvgNode: Nullable<NodeSvg>,
  ): void {
    if (!node) {
      return;
    }
    this.nodesSvg.update((v) => [...v, { val: node.val, x: node.x, y: node.y }]);

    if (node && prevSvgNode && node.val) {
      this.pathsSvg.update((v) => [
        ...v,
        { x1: node.x, y1: node.y, x2: prevSvgNode.x, y2: prevSvgNode.y },
      ]);
    }

    const lastSvgNode = this.nodesSvg()[this.nodesSvg().length - 1];
    this.drawTree(node.left!, lastSvgNode);
    this.drawTree(node.right!, lastSvgNode);
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
      it.x = 100 + idx * 40;
    });

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
    };

    dfs(this.root);
  }

  private createEmptyNodes(node: TreeNode): void {
    if (node.level > this.totalLevels) {
      return;
    }

    if (!node.left) {
      node.left = {
        val: null,
        left: null,
        right: null,
        x: 0,
        y: 0,
        level: node.level + 1,
      };
    }

    if (!node.right) {
      node.right = {
        val: null,
        left: null,
        right: null,
        x: 0,
        y: 0,
        level: node.level + 1,
      };
    }

    this.createEmptyNodes(node.left);
    this.createEmptyNodes(node.right)
  }

  private moveTreeToMiddle(): void {
    const root = this.root;
    if (!root) {
      return;
    }
    const svgWidth = this.svg.nativeElement.clientWidth;
    const rootX = root.x;
    const svgCenterX = svgWidth / 2;

    const diff = svgCenterX - rootX;
    const queue: Nullable<TreeNode>[] = [root];

    while (queue.length) {
      const node = queue.shift()!;
      if (!node) {
        continue;
      }
      node.x += diff;
      queue.push(node.left);
      queue.push(node.right);
    }
  }

  private initRootAndDrawTree(arr: Nullable<number>[]): void {
    this.root = this.convertToTree(arr);
    this.createEmptyNodes(this.root);
    if (!this.root) {
      return;
    }
    this.setNodesCoordinates();
    this.moveTreeToMiddle();
    this.drawTree(this.root, null);
  }

  private clearSvgData(): void {
    this.pathsSvg.set([]);
    this.nodesSvg.set([]);
  }
}
