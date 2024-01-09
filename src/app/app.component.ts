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
import { createEmptyNodes } from './utils/create-empty-nodes.util';
import { setNodesCoordinates } from './utils/set-node-coordinates.util';
import { removeEmptyNodes } from './utils/remove-empty-nodes.util';

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
  readonly orderFormControl = new FormControl(this.orderOptions[0].value);
  readonly arrAsStringFormControl = new FormControl('');

  root?: TreeNode;
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
          this.arrAsStringFormControl.disable();

          switch (this.orderFormControl.value) {
            case 'in-order':
              this.traverseInOrder(this.root!);
              break;
            case 'pre-order':
              this.traversePreOrder(this.root!);
              break;
            case 'post-order':
              this.traversePostOrder(this.root!);
              break;
            default:
              break;
          }
        } else {
          this.unregisterToNodeStatus();
          this.arrAsStringFormControl.enable();
          this.resetNodeStatus();
        }
      },
      {
        allowSignalWrites: true,
      }
    );
  }

  ngOnInit(): void {
    this.arrAsStringFormControl.addValidators((control) => {
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

    this.arrAsStringFormControl.valueChanges
      .pipe(
        debounceTime(400),
        filter(() => this.arrAsStringFormControl.valid),
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

    this.arrAsStringFormControl.setValue(this.DEFAULT_VALUE);
  }

  ngAfterViewInit(): void {
    this.panZoom = (window as any).panzoom(this.gContainer.nativeElement, {});
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
    if (!this.root) {
      return;
    }
    createEmptyNodes(this.root, this.totalLevels);
    setNodesCoordinates(this.root!);

    // Remove empty nodes and update nodesSvg
    removeEmptyNodes(this.root!);
    this.nodesSvg.update((v) => v.filter((it) => it.val !== null));

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
