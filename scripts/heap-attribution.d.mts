export function attribute(snapshot: {
  nodes: number[]; edges: number[]; strings: string[];
  snapshot: { meta: { node_fields: string[]; node_types: (string[] | string)[]; edge_fields: string[]; edge_types: (string[] | string)[] } };
}): {
  method: string; nodes: number; reachable: number; totalSelfMiB: number;
  byTypeMiB: Record<string, number>;
  topDominators: { id: number; type: string; name: string; selfMiB: number; retainedMiB: number }[];
}
