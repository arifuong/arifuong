#!/usr/bin/env node

import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { loadConfig, readFlag, repositoryRoot } from "./lib/config.mjs";
import { generateHeroAssets } from "./lib/hero.mjs";
import { generateProfileReadme } from "./lib/readme.mjs";

async function resolveSource(config) {
  const source = readFlag("--source");
  if (source) return { sourcePath: resolve(source) };

  const sharp = (await import("sharp")).default;

  const avatarPath = config.profile?.avatar || "assets/portrait.png";
  const fullPath = resolve(repositoryRoot, avatarPath);
  try {
    await access(fullPath);
    console.log(`Using local portrait: ${avatarPath}`);
    return { sourcePath: fullPath };
  } catch {}

  const username = config.profile.username;
  const avatarUrl = `https://github.com/${username}.png`;
  try {
    console.log(`Downloading GitHub avatar for ${username}...`);
    const response = await fetch(avatarUrl);
    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      const tempDir = await mkdtemp(join(tmpdir(), "profile-"));
      const tempPath = join(tempDir, "avatar.png");
      await writeFile(tempPath, buffer);
      return { sourcePath: tempPath, tempDir };
    }
  } catch {}

  console.warn("No portrait found. Using transparent placeholder.");
  const tempDir = await mkdtemp(join(tmpdir(), "profile-"));
  const tempPath = join(tempDir, "default.png");
  await sharp({
    create: { width: 200, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).png().toFile(tempPath);
  return { sourcePath: tempPath, tempDir };
}

const config = await loadConfig(readFlag("--config"));
const { sourcePath, tempDir } = await resolveSource(config);

try {
  const manifest = await generateHeroAssets({
    config,
    sourcePath,
    outputDirectory: resolve(repositoryRoot, "assets/hero")
  });
  await generateProfileReadme({ config, manifest, readmePath: resolve(repositoryRoot, "README.md") });
  console.log(`Profile generated successfully (asset version ${manifest.version}).`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
}
