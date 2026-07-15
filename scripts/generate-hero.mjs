#!/usr/bin/env node

import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { loadConfig, readFlag, repositoryRoot } from "./lib/config.mjs";
import { generateHeroAssets } from "./lib/hero.mjs";

const source = readFlag("--source");

let sourcePath;
let tempDir;

if (source) {
  sourcePath = resolve(source);
} else {
  const sharp = (await import("sharp")).default;
  tempDir = await mkdtemp(join(tmpdir(), "profile-"));
  sourcePath = join(tempDir, "default.png");
  await sharp({
    create: { width: 200, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).png().toFile(sourcePath);
}

try {
  const configPath = readFlag("--config");
  const config = await loadConfig(configPath);
  const manifest = await generateHeroAssets({
    config,
    sourcePath,
    outputDirectory: resolve(repositoryRoot, "assets/hero")
  });
  console.log(`Generated four hero assets (version ${manifest.version}).`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
}
