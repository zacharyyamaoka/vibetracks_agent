// node viewer/src/scenes/vendor/three/vendor.mjs [path/to/node_modules/three]: the 3-D scene's stock part, three.js 0.186.1
// (the version trajectory_tracking_agent's site/assets/viewer3d.js loads), bundled once into ONE minified ES module with
// only the names bb-scene-3d uses plus OrbitControls. WHY a bundle, not a CDN or the npm tree: a box's page must work
// offline and from file copies (viewer/tools/vendor.mjs's rule), the npm package ships ~2 MB of unminified ESM, and
// OrbitControls imports the bare specifier 'three', which a plain static page cannot resolve. Never edit three.bundle.js:
// re-run this. The source is a local copy of the npm package (default: ~/data-ui/node_modules/three, pinned there).
import { build } from '../../../../storybook/node_modules/esbuild/lib/main.js';
import { createHash } from 'node:crypto';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] || join(homedir(), 'data-ui', 'node_modules', 'three');
const pkg = JSON.parse(readFileSync(join(SRC, 'package.json'), 'utf8'));
if (pkg.version !== '0.186.1') throw new Error(`three ${pkg.version}: this vendoring pins 0.186.1`);
export const NAMES = ['WebGLRenderer', 'Scene', 'PerspectiveCamera', 'OrthographicCamera', 'Group', 'HemisphereLight', 'DirectionalLight',
  'Mesh', 'MeshStandardMaterial', 'MeshBasicMaterial', 'CapsuleGeometry', 'CylinderGeometry', 'SphereGeometry', 'BoxGeometry',
  'PlaneGeometry', 'GridHelper', 'CanvasTexture', 'BufferGeometry', 'BufferAttribute', 'Line', 'LineSegments', 'LineBasicMaterial',
  'LineDashedMaterial', 'Vector3', 'Quaternion', 'Matrix4', 'Color', 'Box3', 'Sprite', 'SpriteMaterial', 'SRGBColorSpace', 'DoubleSide',
  'TubeGeometry', 'CatmullRomCurve3'];
const entry = `export { ${NAMES.join(', ')} } from 'three';\nexport { OrbitControls } from '${join(SRC, 'examples', 'jsm', 'controls', 'OrbitControls.js')}';\n`;
const out = join(HERE, 'three.bundle.js');
await build({
  stdin: { contents: entry, resolveDir: HERE, loader: 'js' }, bundle: true, format: 'esm', target: 'es2022', minify: true,
  outfile: out, legalComments: 'none', logLevel: 'warning', alias: { three: join(SRC, 'build', 'three.module.js') },
  nodePaths: [dirname(SRC)],
  banner: { js: `/* three.js ${pkg.version} (MIT, (c) 2010-2026 three.js authors; LICENSE beside this file): ${NAMES.length} names + OrbitControls, bundled by vendor.mjs. Do not edit. */` },
});
copyFileSync(join(SRC, 'LICENSE'), join(HERE, 'LICENSE'));
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
writeFileSync(join(HERE, 'VENDOR.json'), JSON.stringify({
  what: 'three.js as bb-scene-3d imports it: re-bundle with node viewer/src/scenes/vendor/three/vendor.mjs, never edit',
  package: 'three', version: pkg.version, license: pkg.license, from: 'npm three 0.186.1 (a local node_modules copy), build/three.module.js + examples/jsm/controls/OrbitControls.js',
  names: [...NAMES, 'OrbitControls'], files: { 'three.bundle.js': sha(out), LICENSE: sha(join(HERE, 'LICENSE')) },
}, null, 1) + '\n');
console.log(`vendored three ${pkg.version} -> src/scenes/vendor/three/three.bundle.js (${(readFileSync(out).length / 1e3).toFixed(0)} kB)`);
