import {
    BufferGeometry,
    Float32BufferAttribute,
    Vector2,
    Vector3
} from 'three'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils'

/**
 *	Simplification Geometry Modifier
 *    - based on code and technique
 *	  - by Stan Melax in 1998
 *	  - Progressive Mesh type Polygon Reduction Algorithm
 *    - http://www.melax.com/polychop/
 */

const _cb = new Vector3(), _ab = new Vector3()

let minimumVertex = null

class SimplifyModifier {

    constructor() {

        if (BufferGeometryUtils === undefined) {

            throw new Error('THREE.SimplifyModifier relies on BufferGeometryUtils')

        }

    }

    modify (geometry, count, noMerge = false) {
        const startTime = performance.now()

        if (geometry.isGeometry === true) {

            console.error('THREE.SimplifyModifier no longer supports Geometry. Use BufferGeometry instead.')
            return

        }

        geometry = geometry.clone()
        const attributes = geometry.attributes

        const originUVs = geometry.getAttribute('uv')

        // this modifier can only process indexed and non-indexed geomtries with a position attribute

        for (const name in attributes) {

            if (name !== 'position') geometry.deleteAttribute(name)

        }

        if (!noMerge) {

            geometry = BufferGeometryUtils.mergeVertices(geometry)

        }

        //
        // put data of original geometry in different data structures
        //

        const vertices = []
        const faces = new Set()

        // add vertices

        const positionAttribute = geometry.getAttribute('position')

        for (let i = 0; i < positionAttribute.count; i++) {

            const v = new Vector3().fromBufferAttribute(positionAttribute, i)

            const vertex = new Vertex(v)
            vertex.id = i
            vertex.originIdx = i
            if (originUVs) {
                vertex.uv.fromBufferAttribute(originUVs, i)
            }
            vertices.push(vertex)

        }

        // add faces

        let index = geometry.getIndex()

        if (index !== null) {

            for (let i = 0; i < index.count; i += 3) {

                const a = index.getX(i)
                const b = index.getX(i + 1)
                const c = index.getX(i + 2)

                // if ((a === b) || (a === c) || (b === c)) {
                // 	throw new Error('triangle constructed by same vertice');
                // }

                const triangle = new Triangle(vertices[a], vertices[b], vertices[c], a, b, c)
                faces.add(triangle)

            }

        } else {

            for (let i = 0; i < positionAttribute.count; i += 3) {

                const a = i
                const b = i + 1
                const c = i + 2

                const triangle = new Triangle(vertices[a], vertices[b], vertices[c], a, b, c)
                faces.add(triangle)

            }

        }

        // compute all edge collapse costs

        for (let v of vertices) {

            computeEdgeCostAtVertex(v)

        }

        let nextVertex

        if (count < 1 && count > 0) {
            const percent = count
            count = (vertices.length * (1 - percent)) >> 0
            console.log(`simplify by percent: ${percent}, count: ${count}, total: ${vertices.length}`)
        }

        let z = count

        while (z--) {

            nextVertex = minimumCostEdge(vertices)

            if (!nextVertex) {

                console.log('THREE.SimplifyModifier: No next vertex')
                break

            }
            collapse(vertices, faces, nextVertex, nextVertex.collapseNeighbor)

        }

        //

        const simplifiedGeometry = new BufferGeometry()
        const position = []
        const uv = []

        index = []

        //

        let i = 0

        for (let vertex of vertices) {

            const v = vertex.position
            position.push(v.x, v.y, v.z)
            if (originUVs) {
                uv.push(vertex.uv.x, vertex.uv.y)
            }
            // cache final index to GREATLY speed up faces reconstruction
            vertex.id = i++

        }

        //

        for (let face of faces) {

            index.push(face.v1.id, face.v2.id, face.v3.id)

        }

        //

        simplifiedGeometry.setAttribute('position', new Float32BufferAttribute(position, 3))
        simplifiedGeometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
        simplifiedGeometry.setIndex(index)

        simplifiedGeometry.clearGroups()

        const endTime = performance.now()

        const timeCost = (endTime - startTime) / 1000

        console.log('time cost: ', timeCost)

        return simplifiedGeometry

    }

}

function pushIfUnique (array, object) {

    if (array.indexOf(object) === - 1) array.push(object)

}

function removeFromArray (array, object) {

    var k = array.indexOf(object)
    if (k > - 1) array.splice(k, 1)

}

function computeEdgeCollapseCost (u, v) {

    // if we collapse edge uv by moving u to v then how
    // much different will the model change, i.e. the "error".

    const edgelength = v.position.distanceTo(u.position)
    let curvature = 0

    const sideFaces = new Set()

    // find the "sides" triangles that are on the edge uv
    for (let face of u.faces) {

        if (face.hasVertex(v)) {

            sideFaces.add(face)

        }

    }

    // use the triangle facing most away from the sides
    // to determine our curvature term
    for (let face of u.faces) {

        let minCurvature = 1

        for (let j = 0; j < sideFaces.length; j++) {

            const sideFace = sideFaces[j]
            // use dot product of face normals.
            const dotProd = face.normal.dot(sideFace.normal)
            minCurvature = Math.min(minCurvature, (1.001 - dotProd) / 2)

        }

        curvature = Math.max(curvature, minCurvature)

    }

    // crude approach in attempt to preserve borders
    // though it seems not to be totally correct
    let borders = 0

    if (sideFaces.size < 2) {

        // we add some arbitrary cost for borders,
        borders += 10
        curvature = 1

    }

    const amt = edgelength * curvature + borders

    return amt

}

function computeEdgeCostAtVertex (v) {

    // compute the edge collapse cost for all edges that start
    // from vertex v.  Since we are only interested in reducing
    // the object by selecting the min cost edge at each step, we
    // only cache the cost of the least cost edge at this vertex
    // (in member variable collapse) as well as the value of the
    // cost (in member variable collapseCost).

    if (v.neighbors.size === 0) {

        // collapse if no neighbors.
        v.collapseNeighbor = null
        v.collapseCost = - 0.01

        return

    }

    v.collapseCost = 100000
    v.collapseNeighbor = null

    // search all neighboring edges for "least cost" edge
    for (let neighbor of v.neighbors) {

        const collapseCost = computeEdgeCollapseCost(v, neighbor)

        if (!v.collapseNeighbor) {

            v.collapseNeighbor = neighbor
            v.collapseCost = collapseCost
            v.minCost = collapseCost
            v.totalCost = 0
            v.costCount = 0

        }

        v.costCount++
        v.totalCost += collapseCost

        if (collapseCost < v.minCost) {

            v.collapseNeighbor = neighbor
            v.minCost = collapseCost

        }

    }

    // we average the cost of collapsing at this vertex
    v.collapseCost = v.totalCost / v.costCount
    // v.collapseCost = v.minCost;

    return v.collapseCost

}

function removeVertex (v, vertices) {

    console.assert(v.faces.size === 0)

    for (let neighbor of v.neighbors) {

        const n = neighbor
        n.neighbors.delete(v)

    }

    v.neighbors.clear()

    removeFromArray(vertices, v)

}

function removeFace (f, faces) {

    faces.delete(f)

    if (f.v1) f.v1.faces.delete(f)
    if (f.v2) f.v2.faces.delete(f)
    if (f.v3) f.v3.faces.delete(f)

    // TODO optimize this!
    const vs = [f.v1, f.v2, f.v3]

    for (let i = 0; i < 3; i++) {

        const v1 = vs[i]
        const v2 = vs[(i + 1) % 3]

        if (!v1 || !v2) continue

        v1.removeIfNonNeighbor(v2)
        v2.removeIfNonNeighbor(v1)

    }

}

function collapse (vertices, faces, u, v) { // u and v are pointers to vertices of an edge

    // Collapse the edge uv by moving vertex u onto v

    if (!v) {

        // u is a vertex all by itself so just delete it..
        removeVertex(u, vertices)
        return

    }

    const tmpVertices = []

    for (let neighbor of u.neighbors) {

        tmpVertices.push(neighbor)

    }


    // delete triangles on edge uv:
    for (let face of u.faces) {

        if (face.hasVertex(v)) {

            removeFace(face, faces)

        }

    }

    // update remaining triangles to have v instead of u
    for (let face of u.faces) {

        face.replaceVertex(u, v)

    }


    removeVertex(u, vertices)

    // recompute the edge collapse costs in neighborhood
    for (let i = 0; i < tmpVertices.length; i++) {

        computeEdgeCostAtVertex(tmpVertices[i])

    }

}



function minimumCostEdge (vertices) {

    // O(n * n) approach. TODO optimize this

    let least = vertices[0]

    for (let i = 0; i < vertices.length; i++) {

        if (vertices[i].collapseCost < least.collapseCost) {

            least = vertices[i]

        }

    }

    return least

}

// we use a triangle class to represent structure of face slightly differently

class Triangle {

    constructor(v1, v2, v3, a, b, c) {

        this.a = a
        this.b = b
        this.c = c

        this.v1 = v1
        this.v2 = v2
        this.v3 = v3

        this.normal = new Vector3()

        this.computeNormal()

        v1.faces.add(this)
        v1.addUniqueNeighbor(v2)
        v1.addUniqueNeighbor(v3)

        if (v2 !== v1) {
            v2.faces.add(this)
            v2.addUniqueNeighbor(v1)
            v2.addUniqueNeighbor(v3)
        }

        if (v3 !== v2 && v3 !== v1) {
            v3.faces.add(this)
            v3.addUniqueNeighbor(v1)
            v3.addUniqueNeighbor(v2)
        }

    }

    computeNormal () {

        const vA = this.v1.position
        const vB = this.v2.position
        const vC = this.v3.position

        _cb.subVectors(vC, vB)
        _ab.subVectors(vA, vB)
        _cb.cross(_ab).normalize()

        this.normal.copy(_cb)

    }

    hasVertex (v) {

        return v === this.v1 || v === this.v2 || v === this.v3

    }

    replaceVertex (oldv, newv) {

        if (oldv === this.v1) this.v1 = newv
        else if (oldv === this.v2) this.v2 = newv
        else if (oldv === this.v3) this.v3 = newv

        oldv.faces.delete(this)
        newv.faces.add(this)


        oldv.removeIfNonNeighbor(this.v1)
        this.v1.removeIfNonNeighbor(oldv)

        oldv.removeIfNonNeighbor(this.v2)
        this.v2.removeIfNonNeighbor(oldv)

        oldv.removeIfNonNeighbor(this.v3)
        this.v3.removeIfNonNeighbor(oldv)

        this.v1.addUniqueNeighbor(this.v2)
        this.v1.addUniqueNeighbor(this.v3)

        this.v2.addUniqueNeighbor(this.v1)
        this.v2.addUniqueNeighbor(this.v3)

        this.v3.addUniqueNeighbor(this.v1)
        this.v3.addUniqueNeighbor(this.v2)

        this.computeNormal()

    }

}

class Vertex {

    constructor(v) {

        this.position = v

        this.id = - 1 // external use position in vertices list (for e.g. face generation)
        this.originIdx = 0
        this.uv = new Vector2()

        this.faces = new Set() // faces vertex is connected
        this.neighbors = new Set() // neighbouring vertices aka "adjacentVertices"

        // these will be computed in computeEdgeCostAtVertex()
        this.collapseCost = 0 // cost of collapsing this vertex, the less the better. aka objdist
        this.collapseNeighbor = null // best candinate for collapsing

    }

    addUniqueNeighbor (vertex) {

        this.neighbors.add(vertex)

    }

    removeIfNonNeighbor (n) {

        const neighbors = this.neighbors
        const faces = this.faces

        const hasNeighbor = neighbors.has(n)

        if (!hasNeighbor) return

        for (let face of faces) {

            if (face.hasVertex(n)) return

        }

        neighbors.delete(n)

    }

}

export { SimplifyModifier }
