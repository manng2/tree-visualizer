import { NodeStatus } from "./node-status.model";
import { Nullable } from "./nullable.model";

export interface NodeSvg {
  val: Nullable<number>;
  x: number;
  y: number;
  status: NodeStatus
}
