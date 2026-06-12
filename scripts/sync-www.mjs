#!/usr/bin/env node
import { access, cp, mkdir, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const webDir = path.join(projectRoot, 'www');

const runtimeEntries = ['index.html', 'sw.js', 'assets'];
const requiredOutputs = ['index.html', 'sw.js', 'assets'];
const requiredProjectEntries = [
  'package.json',
  'index.html',
  'sw.js',
  'assets',
  'capacitor.config.ts'
];
const maplibreVersion = '5.24.0';
const requiredVendorOutputs = [
  `assets/vendor/maplibre-gl/${maplibreVersion}/maplibre-gl.js`,
  `assets/vendor/maplibre-gl/${maplibreVersion}/maplibre-gl.css`
];

async function ensureReadable(sourcePath) {
  try {
    await access(sourcePath, constants.R_OK);
  } catch {
    throw new Error(`Missing required source: ${path.relative(projectRoot, sourcePath)}`);
  }
}

function validateWebDirTarget() {
  const normalizedRoot = path.resolve(projectRoot);
  const normalizedWebDir = path.resolve(webDir);

  if (path.basename(normalizedWebDir) !== 'www') {
    throw new Error(`Safety check failed: target directory must be named "www", got "${path.basename(normalizedWebDir)}".`);
  }

  if (path.dirname(normalizedWebDir) !== normalizedRoot) {
    throw new Error('Safety check failed: target directory must be a direct child of project root.');
  }
}

async function validateProjectRoot() {
  for (const entry of requiredProjectEntries) {
    await ensureReadable(path.join(projectRoot, entry));
  }
}

async function main() {
  await validateProjectRoot();
  validateWebDirTarget();

  await rm(webDir, { recursive: true, force: true });
  await mkdir(webDir, { recursive: true });

  for (const entry of runtimeEntries) {
    const sourcePath = path.join(projectRoot, entry);
    const targetPath = path.join(webDir, entry);

    await ensureReadable(sourcePath);
    await cp(sourcePath, targetPath, { recursive: true });
  }

  for (const entry of requiredOutputs) {
    const targetPath = path.join(webDir, entry);
    await ensureReadable(targetPath);
  }

  for (const entry of requiredVendorOutputs) {
    const sourcePath = path.join(projectRoot, entry);
    const targetPath = path.join(webDir, entry);
    await ensureReadable(sourcePath);
    await ensureReadable(targetPath);
  }

  console.log('www synced successfully.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
