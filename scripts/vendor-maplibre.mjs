#!/usr/bin/env node
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const version = '5.24.0';
const baseUrl = `https://unpkg.com/maplibre-gl@${version}/dist`;
const targetDir = path.join(process.cwd(), 'assets', 'vendor', 'maplibre-gl', version);
const assets = [
  { name: 'maplibre-gl.js', minimumBytes: 900_000, signature: 'maplibregl' },
  { name: 'maplibre-gl.css', minimumBytes: 60_000, signature: '.maplibregl-' }
];

async function isValidAsset(filePath, asset) {
  try {
    const details = await stat(filePath);
    if (!details.isFile() || details.size < asset.minimumBytes) return false;

    const body = await readFile(filePath);
    const textSample = body.subarray(0, Math.min(body.length, 200_000)).toString('utf8');
    return textSample.includes(asset.signature);
  } catch {
    return false;
  }
}

async function downloadAsset(asset) {
  const targetPath = path.join(targetDir, asset.name);
  if (await isValidAsset(targetPath, asset)) {
    console.log(`MapLibre ${version} asset ready: ${path.relative(process.cwd(), targetPath)}`);
    return;
  }

  const response = await fetch(`${baseUrl}/${asset.name}`, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Failed to download ${asset.name}: HTTP ${response.status}`);
  }

  const body = Buffer.from(await response.arrayBuffer());
  const textSample = body.subarray(0, Math.min(body.length, 200_000)).toString('utf8');
  if (body.length < asset.minimumBytes || !textSample.includes(asset.signature)) {
    throw new Error(`Downloaded ${asset.name} did not pass the pinned asset validation`);
  }

  const temporaryPath = `${targetPath}.tmp`;
  await writeFile(temporaryPath, body);
  await rename(temporaryPath, targetPath);
  console.log(`Vendored MapLibre ${version}: ${path.relative(process.cwd(), targetPath)}`);
}

async function main() {
  await mkdir(targetDir, { recursive: true });

  try {
    for (const asset of assets) await downloadAsset(asset);
  } catch (error) {
    for (const asset of assets) {
      await unlink(path.join(targetDir, `${asset.name}.tmp`)).catch(() => {});
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
