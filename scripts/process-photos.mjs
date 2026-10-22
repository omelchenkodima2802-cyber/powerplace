import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const rootDir = "c:/Users/Dima/OneDrive/Desktop/PowerPlace";
const imagesDir = path.join(rootDir, "images");
const galleryDir = path.join(imagesDir, "gallery");
const barDir = path.join(imagesDir, "bar");
const manifestPath = path.join(galleryDir, "manifest.json");

const MAX_LONG_SIDE = 1600;
const THUMB_WIDTH = 800;
const BAR_WIDTH = 900;
const BAR_HEIGHT = 1125;

const altByCategory = {
  gym: "Силова зона Power Place",
  reception: "Ресепшн Power Place",
  locker: "Роздягальня Power Place",
  massage: "Масажний кабінет Power Place"
};

const sortBySequence = (a, b) => {
  const aOrder = Number.parseInt(a.split("-")[1], 10);
  const bOrder = Number.parseInt(b.split("-")[1], 10);
  return aOrder - bOrder;
};

const ensureDir = async (targetPath) => {
  await fs.mkdir(targetPath, { recursive: true });
};

const processGallery = async () => {
  const entries = (await fs.readdir(galleryDir))
    .filter((fileName) => /^gallery-\d{2}-[a-z]+\.webp$/i.test(fileName) && !fileName.includes("-sm."))
    .sort(sortBySequence);

  const manifest = [];

  for (const fileName of entries) {
    const sourcePath = path.join(galleryDir, fileName);
    const [, order, categoryWithExt] = fileName.split("-");
    const category = categoryWithExt.replace(".webp", "");
    const thumbName = `gallery-${order}-${category}-sm.webp`;
    const thumbPath = path.join(galleryDir, thumbName);
    const sourceStats = await fs.stat(sourcePath);
    const sourceImage = sharp(sourcePath);
    const metadata = await sourceImage.metadata();
    const sourceWidth = metadata.width || 0;
    const sourceHeight = metadata.height || 0;
    const longSide = Math.max(sourceWidth, sourceHeight);

    if (longSide > MAX_LONG_SIDE || sourceStats.size > 250 * 1024) {
      await sourceImage
        .resize({
          width: sourceWidth >= sourceHeight ? MAX_LONG_SIDE : null,
          height: sourceHeight > sourceWidth ? MAX_LONG_SIDE : null,
          fit: "inside",
          withoutEnlargement: true
        })
        .webp({ quality: 80 })
        .toFile(`${sourcePath}.tmp`);

      await fs.rename(`${sourcePath}.tmp`, sourcePath);
    }

    const normalizedMetadata = await sharp(sourcePath).metadata();
    await sharp(sourcePath)
      .resize({
        width: Math.min(THUMB_WIDTH, normalizedMetadata.width || THUMB_WIDTH),
        fit: "inside",
        withoutEnlargement: true
      })
      .webp({ quality: 82 })
      .toFile(thumbPath);

    manifest.push({
      src: `images/gallery/${fileName}`,
      srcSm: `images/gallery/${thumbName}`,
      category,
      width: normalizedMetadata.width,
      height: normalizedMetadata.height,
      alt: altByCategory[category] || "Power Place"
    });
  }

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
};

const processBar = async () => {
  await ensureDir(barDir);
  const barEntries = (await fs.readdir(galleryDir))
    .filter((fileName) => /^bar-\d{2}-[a-z]+\.webp$/i.test(fileName))
    .sort(sortBySequence);

  for (const fileName of barEntries) {
    await sharp(path.join(galleryDir, fileName))
      .resize(BAR_WIDTH, BAR_HEIGHT, {
        fit: "cover",
        position: "centre",
        withoutEnlargement: true
      })
      .webp({ quality: 82 })
      .toFile(path.join(barDir, fileName));
  }
};

await ensureDir(barDir);
await processGallery();
await processBar();
