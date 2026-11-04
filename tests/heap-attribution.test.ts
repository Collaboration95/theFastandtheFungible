import { expect, it } from 'vitest'
import { attribute } from '../scripts/heap-attribution.mjs'
it('counts shared descendants once and excludes weak reachability', () => {
  // root -> a,b; a,b -> shared; a weakly -> garbage. Each node is ten bytes.
  const nodes = [0,0,1,10,2, 0,1,3,10,2, 0,2,5,10,1, 0,3,7,10,0, 0,4,9,10,0]
  const edges = [0,5, 0,10, 0,15, 1,20, 0,15]
  const result = attribute({ nodes, edges, strings: ['root','a','b','shared','garbage'], snapshot: { meta: {
    node_fields: ['type','name','id','self_size','edge_count'], node_types: [['object']],
    edge_fields: ['type','to_node'], edge_types: [['property','weak']],
  } } })
  expect(result.reachable).toBe(4)
  expect(result.totalSelfMiB * 1048576).toBe(40)
  expect(result.topDominators.map((n: { retainedMiB: number }) => n.retainedMiB * 1048576)).toEqual([10,10,10])
})
