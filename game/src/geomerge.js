// geomerge.js — merge many small coloured boxes/planes into ONE geometry so
// the city, cars and people cost a handful of draw calls instead of thousands.
// Each part contributes its geometry (transformed in place by the caller with
// geometry.rotate*/translate*) and a flat colour, written into a colour
// attribute; one shared vertex-coloured material renders the whole merge.

export function mergeColoredParts(THREE, parts) {
  let vertexCount = 0;
  const prepared = parts.map(({ geo, color }) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    vertexCount += g.attributes.position.count;
    return { g, color: new THREE.Color(color) };
  });
  const position = new Float32Array(vertexCount * 3);
  const normal = new Float32Array(vertexCount * 3);
  const uv = new Float32Array(vertexCount * 2);
  const colour = new Float32Array(vertexCount * 3);
  let offset = 0;
  for (const { g, color } of prepared) {
    const n = g.attributes.position.count;
    position.set(g.attributes.position.array, offset * 3);
    normal.set(g.attributes.normal.array, offset * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, offset * 2);
    for (let i = 0; i < n; i++) {
      colour[(offset + i) * 3] = color.r;
      colour[(offset + i) * 3 + 1] = color.g;
      colour[(offset + i) * 3 + 2] = color.b;
    }
    offset += n;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  merged.setAttribute('color', new THREE.BufferAttribute(colour, 3));
  return merged;
}

/** One shared material for every merged mesh in the game. */
export function coloredMaterial(THREE) {
  return new THREE.MeshLambertMaterial({ vertexColors: true });
}

/** A box part, already sized, rotated and moved into place. */
export function boxPart(THREE, w, h, d, x, y, z, color, rotY = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (rotY) geo.rotateY(rotY);
  geo.translate(x, y, z);
  return { geo, color };
}
