#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const rootDir = projectRoot;
const wwwDir = path.join(projectRoot, 'www');
const androidDir = path.join(projectRoot, 'android/app/src/main/assets/public');

const runtimeFiles = [
  'index.html',
  'assets/js/map/map-user-location.js',
  'assets/js/map/water-depth-contours-layer.js',
  'assets/js/map/depth-feature-classifier.js',
  'assets/js/map/depth-maps-registry.js'
];
const depthDirectory = 'assets/data/depth-contours';

async function readRequiredFile(baseDir, relativePath) {
  try {
    return await readFile(path.join(baseDir, relativePath));
  } catch {
    throw new Error(`Missing required generated asset: ${path.relative(projectRoot, path.join(baseDir, relativePath))}`);
  }
}

async function listDepthFiles(baseDir) {
  const directory = path.join(baseDir, depthDirectory);
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    throw new Error(`Missing required generated asset directory: ${path.relative(projectRoot, directory)}`);
  }

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

async function compareFile(relativePath, sourceDir, targetDir, targetLabel) {
  const [source, target] = await Promise.all([
    readRequiredFile(sourceDir, relativePath),
    readRequiredFile(targetDir, relativePath)
  ]);

  if (!source.equals(target)) {
    throw new Error(
      `${targetLabel} is stale: ${relativePath} differs from ${path.relative(projectRoot, sourceDir) || 'project root'}.`
    );
  }
}

async function compareDepthAssets(sourceDir, targetDir, targetLabel) {
  const [sourceFiles, targetFiles] = await Promise.all([
    listDepthFiles(sourceDir),
    listDepthFiles(targetDir)
  ]);

  if (sourceFiles.join('\n') !== targetFiles.join('\n')) {
    const missing = sourceFiles.filter((file) => !targetFiles.includes(file));
    const extra = targetFiles.filter((file) => !sourceFiles.includes(file));
    throw new Error(
      `${targetLabel} depth assets are stale. Missing: ${missing.join(', ') || 'none'}. Extra: ${extra.join(', ') || 'none'}.`
    );
  }

  for (const file of sourceFiles) {
    await compareFile(path.join(depthDirectory, file), sourceDir, targetDir, targetLabel);
  }
}

async function compareTrees(sourceDir, targetDir, targetLabel) {
  for (const relativePath of runtimeFiles) {
    await compareFile(relativePath, sourceDir, targetDir, targetLabel);
  }
  await compareDepthAssets(sourceDir, targetDir, targetLabel);
}

async function main() {
  await compareTrees(rootDir, wwwDir, 'www');
  await compareTrees(wwwDir, androidDir, 'Android packaged assets');
  console.log('Capacitor web assets are current: root == www == Android public.');
}

main().catch((error) => {
  console.error(error.message);
  console.error('Run "npm run prepare:android" before building the APK.');
  process.exitCode = 1;
});
