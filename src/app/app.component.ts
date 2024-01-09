import { DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  WritableSignal,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { Subject, Subscription, concatMap, debounceTime, delay, filter, map, of, takeUntil } from 'rxjs';
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
  private readonly _nodeStatusEmitter$ = new Subject<
    Nullable<{ node: TreeNode; status: 'explored' | 'visited' | 'unvisited' }>
  >();
  private readonly _destroyRef = inject(DestroyRef);
  private _nodeStatusListener$?: Subscription;

  readonly document = inject(DOCUMENT);
  readonly DEFAULT_VALUE = '1,2,3,4,5,6';
  readonly BASE_HORIZONTAL_DISTANCE_TO_ROOT = 150;
  readonly isVisualizing = signal(false);
  readonly orderOptions = [
    {
      label: 'In Order',
      value: 'in-order',
    },
    {
      label: 'Pre Order',
      value: 'pre-order',
    },
    {
      label: 'Post Order',
      value: 'post-order',
    },
  ];
  order = new FormControl(this.orderOptions[0].value);

  arrAsString = new FormControl('');
  root!: TreeNode;
  pathsSvg: WritableSignal<PathSvg[]> = signal([]);
  nodesSvg: WritableSignal<NodeSvg[]> = signal([]);
  panZoom: any;
  totalLevels = 0;

  @ViewChild('svg') svg!: ElementRef<SVGElement>;
  @ViewChild('gContainer') gContainer!: ElementRef<SVGGElement>;

  constructor() {
    effect(
      () => {
        if (this.isVisualizing()) {
          this.registerToNodeStatus();
          this.arrAsString.disable();

          switch (this.order.value) {
            case 'in-order':
              this.traverseInOrder(this.root);
              break;
            case 'pre-order':
              this.traversePreOrder(this.root);
              break;
            case 'post-order':
              this.traversePostOrder(this.root);
              break;
            default:
              break;
          }
        } else {
          this.unregisterToNodeStatus();
          this.arrAsString.enable();
          this.resetNodeStatus();
        }
      },
      {
        allowSignalWrites: true,
      }
    );
  }

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
    this.totalLevels = 1;

    arr.forEach(() => {
      const leftVal = arr[lastCheckedIdx + 1];
      const rightVal = arr[lastCheckedIdx + 2];

      if (leftVal || leftVal === 0) {
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

      if (rightVal || rightVal === 0) {
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

  private drawTree(node: TreeNode, prevSvgNode: Nullable<NodeSvg>): void {
    if (!node) {
      return;
    }
    this.nodesSvg.update((v) => [
      ...v,
      { val: node.val, x: node.x, y: node.y, status: 'unvisited' },
    ]);

    if (node && prevSvgNode && (node.val || node.val === 0)) {
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
      it.x = 100 + idx * 25;
    });

    const dfs = (node: Nullable<TreeNode>) => {
      if (!node) {
        return;
      }

      dfs(node.left);
      dfs(node.right);

      if (node.left && node.right) {
        node.x = (node.left.x + node.right.x) / 2;
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
    this.createEmptyNodes(node.right);
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

  private removeEmptyNodes(): void {
    const queue: Nullable<TreeNode>[] = [this.root!];

    while (queue.length) {
      const node = queue.shift()!;
      if (!node) {
        continue;
      }
      const left = node.left;
      const right = node.right;

      if (left && left.val === null) {
        node.left = null;
      }

      if (right && right.val === null) {
        node.right = null;
      }

      queue.push(left);
      queue.push(right);
    }
    this.nodesSvg.update((v) => v.filter((it) => it.val !== null));
  }

  private initRootAndDrawTree(arr: Nullable<number>[]): void {
    this.root = this.convertToTree(arr);
    this.createEmptyNodes(this.root);
    if (!this.root) {
      return;
    }
    this.setNodesCoordinates();
    this.removeEmptyNodes();
    this.moveTreeToMiddle();
    this.drawTree(this.root, null);
  }

  private resetNodeStatus(): void {
    this.nodesSvg.update((v) => {
      return v.map((it) => ({ ...it, status: 'unvisited' }));
    });
  }

  private clearSvgData(): void {
    this.pathsSvg.set([]);
    this.nodesSvg.set([]);
  }

  private traverseInOrder(node: Nullable<TreeNode>): void {
    if (!node) {
      return;
    }
    this._nodeStatusEmitter$.next({ node, status: 'explored' });
    this.traverseInOrder(node.left);
    this._nodeStatusEmitter$.next({ node, status: 'visited' });
    this.traverseInOrder(node.right);
  }

  private traversePreOrder(node: Nullable<TreeNode>): void {
    if (!node) {
      return;
    }
    this._nodeStatusEmitter$.next({ node, status: 'explored' });
    this._nodeStatusEmitter$.next({ node, status: 'visited' });
    this.traversePreOrder(node.left);
    this.traversePreOrder(node.right);
  }

  private traversePostOrder(node: Nullable<TreeNode>): void {
    if (!node) {
      return;
    }
    this._nodeStatusEmitter$.next({ node, status: 'explored' });
    this.traversePostOrder(node.left);
    this.traversePostOrder(node.right);
    this._nodeStatusEmitter$.next({ node, status: 'visited' });
  }

  private registerToNodeStatus(): void {
    this._nodeStatusListener$ = this._nodeStatusEmitter$
      .asObservable()
      .pipe(
        filter(Boolean),
        concatMap((value) => of(value).pipe(delay(500))),
        takeUntilDestroyed(this._destroyRef)
      )
      .subscribe({
        next: ({ node, status }) => {
          this.nodesSvg.update((v) => {
            const nodeIdx = v.findIndex((it) => it.x === node.x && it.y === node.y);
            v[nodeIdx] = { ...v[nodeIdx], status };
            return [...v];
          });
        },
      });
  }

  private unregisterToNodeStatus(): void {
    this._nodeStatusListener$?.unsubscribe();
  }
}
