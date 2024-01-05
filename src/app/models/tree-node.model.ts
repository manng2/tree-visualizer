import { Nullable } from "./nullable.model";

export interface TreeNode {
  val: number;
  left: Nullable<TreeNode>;
  right: Nullable<TreeNode>;
  x: number;
  y: number;
  level: number;
}
