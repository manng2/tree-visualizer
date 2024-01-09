import { Nullable } from "../models/nullable.model";
import { TreeNode } from "../models/tree-node.model";

export function removeEmptyNodes(root: TreeNode): void {
  const queue: Nullable<TreeNode>[] = [root];

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
}
