// Asset pipeline used for the Higgsfield GLBs (run with: npm i -D @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp)
// usage: node tools/optimize-glb.mjs in.glb out.glb <targetTriangles> <textureSize>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, textureCompress, meshopt, dedup, prune, flatten, join } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const [inp, out, targetTris, texSize] = process.argv.slice(2);
await MeshoptSimplifier.ready; await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(inp);
let tris = 0;
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
const ratio = Math.min(1, (+targetTris) / tris);
// Materials: matte, non-metallic, single-sided where possible
for (const mat of doc.getRoot().listMaterials()) { mat.setMetallicFactor(0); mat.setRoughnessFactor(0.6); }
await doc.transform(
  dedup(), flatten(), join(), weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002, lockBorder: false }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [+texSize, +texSize], quality: 82 }),
  prune(),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
let t2 = 0;
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) t2 += (p.getIndices()?.getCount() ?? 0) / 3;
await io.write(out, doc);
console.log(out.split('/').pop(), 'tris', tris, '->', t2);
