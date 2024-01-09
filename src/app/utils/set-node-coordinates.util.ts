import { Nullable } from "../models/nullable.model";
import { TreeNode } from "../models/tree-node.model";

export function setNodesCoordinates(root: TreeNode): void {
  const queue: Nullable<TreeNode>[] = [root];
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

  dfs(root);
}
