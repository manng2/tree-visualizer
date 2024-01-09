import { TreeNode } from '../models/tree-node.model';

export function createEmptyNodes(node: TreeNode, totalLevels: number): void {
  if (node.level > totalLevels) {
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

  createEmptyNodes(node.left, totalLevels);
  createEmptyNodes(node.right, totalLevels);
}
