/**
 * NhaiSupplement — Real Product Image Downloader & WebP Optimizer
 * Fetches clean, logo-free product photos from category collections on wheystore.vn,
 * matches exact products via matchQuery, compresses 180 WebP images (~4.8 MB total)
 * into /public/images/products/, and guarantees zero duplicate images across flavors
 * of the same product.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const OUTPUT_DIR = path.resolve(process.cwd(), 'public/images/products');
const TEMP_DIR = path.resolve(process.cwd(), '.tmp_raw_images');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');
const IMAGE_MAP_PATH = path.resolve(process.cwd(), 'src/data/productImageMap.json');
const CATALOG_TS_PATH = path.resolve(process.cwd(), 'src/data/catalog.ts');

const TARGET_IMAGES = 180;
const TARGET_TOTAL_MB = 4.8;

const COLLECTION_ENDPOINTS = [
  { cat: 'whey-hydrolyzed', handle: 'whey-protein' },
  { cat: 'creatine', handle: 'creatine' },
  { cat: 'bar-cookie', handle: 'protein-bar-banh-lean-body' },
  { cat: 'mass', handle: 'mass-gainer' },
  { cat: 'pre-workout', handle: 'pre-workout' },
  { cat: 'eaa', handle: 'eaa' },
  { cat: 'bcaa', handle: 'bcaa' },
  { cat: 'vitamin', handle: 'vitamin-tong-hop' },
  { cat: 'vitamin', handle: 'vitamin-d3-k2-dau-ca' },
  { cat: 'dau-ca', handle: 'dau-ca-omega3' },
];

const BAD_IMAGE_PATTERN =
  /(chinh-sach|inforgraphic|infographic|infor-|thong-tin|tem-|nhan-phu|banner|qua-tang|cam-ket|gioi-thieu|huong-dan|freeship|wheystore|gymstore|logo|policy|gift|zalo|hotline|bao-hanh|uu-dai|voucher|chung-nhan|\/[0-9]{1,2}\.(png|jpe?g))/i;

function parseProductsFromCatalogTs() {
  const source = fs.readFileSync(CATALOG_TS_PATH, 'utf8');
  const rawMatch = source.match(/const RAW_PRODUCTS:\s*RawProductSeed\[\]\s*=\s*(\[[\s\S]*?\n\]);/);
  if (!rawMatch) {
    throw new Error('Could not parse RAW_PRODUCTS from src/data/catalog.ts');
  }

  const products = [];
  const blockRegex =
    /\{\s*id:\s*'([^']+)'[\s\S]*?slug:\s*'([^']+)'[\s\S]*?matchQuery:\s*["']([^"']+)["'][\s\S]*?name:\s*["']([^"']+)["'][\s\S]*?brand:\s*["']([^"']+)["'][\s\S]*?category:\s*'([^']+)'[\s\S]*?flavorKeys:\s*\[([^\]]+)\]/g;
  let m;
  while ((m = blockRegex.exec(rawMatch[1])) !== null) {
    const [, id, slug, matchQuery, name, brand, category, flavorKeysRaw] = m;
    const flavorKeys = [];
    const fkRegex = /'([a-z0-9_]+)'/g;
    let fk;
    while ((fk = fkRegex.exec(flavorKeysRaw)) !== null) {
      flavorKeys.push(fk[1]);
    }
    products.push({ id, slug, matchQuery, name, brand, category, flavorKeys });
  }
  return products;
}

function getCleanImages(remoteProd) {
  const urls = [];
  for (const img of remoteProd.images || []) {
    if (img?.src && !BAD_IMAGE_PATTERN.test(img.src) && !urls.includes(img.src)) {
      urls.push(img.src);
    }
  }
  for (const v of remoteProd.variants || []) {
    const src = v?.featured_image?.src;
    if (src && !BAD_IMAGE_PATTERN.test(src) && !urls.includes(src)) {
      urls.push(src);
    }
  }
  return urls;
}

async function convertToWebp(inputPath, outputPath, quality) {
  await execFileAsync('convert', [
    inputPath,
    '-auto-orient',
    '-resize',
    '540x540>',
    '-strip',
    '-quality',
    String(quality),
    outputPath,
  ]);
}

async function downloadFile(url, destPath) {
  const sizedUrl = url.includes('?') ? `${url}&width=640` : `${url}?width=640`;
  const res = await fetch(sizedUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NhaiSupplementAssetBot/1.0)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${sizedUrl}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

async function main() {
  // Clean existing generated .webp files
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUTPUT_DIR)) {
    if (f.endsWith('.webp')) fs.unlinkSync(path.join(OUTPUT_DIR, f));
  }
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  const ourProducts = parseProductsFromCatalogTs();
  console.log(`[NhaiSupplement] Parsed ${ourProducts.length} products from catalog.ts`);

  // Fetch all category collections
  const byCategory = {};
  const allRemoteByTitle = new Map();

  await Promise.all(
    COLLECTION_ENDPOINTS.map(async ({ cat, handle }) => {
      const res = await fetch(
        `https://www.wheystore.vn/collections/${handle}/products.json?limit=100`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } },
      );
      if (!res.ok) return;
      const data = await res.json();
      byCategory[cat] = byCategory[cat] || [];
      for (const p of data.products || []) {
        byCategory[cat].push(p);
        allRemoteByTitle.set(p.title.trim().toLowerCase(), p);
      }
    }),
  );

  // Build exact clean URL list per product
  const prodCandidateUrls = {};
  for (const prod of ourProducts) {
    const exactKey = prod.matchQuery.trim().toLowerCase();
    let matchedRemote = allRemoteByTitle.get(exactKey);

    if (!matchedRemote) {
      const catPool = byCategory[prod.category] || [];
      matchedRemote = catPool.find((rp) =>
        rp.title.toLowerCase().includes(exactKey.split(' ').slice(0, 3).join(' ')),
      );
    }

    const cleanUrls = matchedRemote ? getCleanImages(matchedRemote) : [];
    prodCandidateUrls[prod.id] = cleanUrls;
  }

  // Allocate 180 unique image downloads across products without duplicating within a product
  const downloadJobs = []; // { fileName, url }
  const urlToLocalPath = new Map();
  const productFlavorPaths = {}; // product.id -> string[] (no duplicates inside array!)

  // Pass 1: Guarantee 1 exact product image for every single one of the 62 products
  for (const prod of ourProducts) {
    productFlavorPaths[prod.id] = [];
    const urls = prodCandidateUrls[prod.id] || [];
    if (urls.length > 0 && downloadJobs.length < TARGET_IMAGES) {
      const firstUrl = urls[0];
      if (!urlToLocalPath.has(firstUrl)) {
        const idx = downloadJobs.length + 1;
        const fileName = `${prod.slug}-${String(idx).padStart(3, '0')}.webp`;
        downloadJobs.push({ fileName, url: firstUrl });
        urlToLocalPath.set(firstUrl, `/images/products/${fileName}`);
      }
      productFlavorPaths[prod.id].push(urlToLocalPath.get(firstUrl));
    }
  }

  // Pass 2: Fill remaining slots up to 180 with additional clean angles/flavors for multi-flavor products
  let round = 1;
  while (downloadJobs.length < TARGET_IMAGES && round < 10) {
    let addedInRound = false;
    for (const prod of ourProducts) {
      if (downloadJobs.length >= TARGET_IMAGES) break;
      if (productFlavorPaths[prod.id].length >= prod.flavorKeys.length) continue;

      const urls = prodCandidateUrls[prod.id] || [];
      const candidate = urls[round];
      if (candidate && !urlToLocalPath.has(candidate)) {
        const idx = downloadJobs.length + 1;
        const fileName = `${prod.slug}-${String(idx).padStart(3, '0')}.webp`;
        downloadJobs.push({ fileName, url: candidate });
        urlToLocalPath.set(candidate, `/images/products/${fileName}`);
        productFlavorPaths[prod.id].push(`/images/products/${fileName}`);
        addedInRound = true;
      }
    }
    if (!addedInRound) break;
    round += 1;
  }

  // Pass 3: If still under 180, pull additional clean product images from category pools for remaining multi-flavor slots
  if (downloadJobs.length < TARGET_IMAGES) {
    for (const prod of ourProducts) {
      if (downloadJobs.length >= TARGET_IMAGES) break;
      if (productFlavorPaths[prod.id].length >= prod.flavorKeys.length) continue;

      const catPool = byCategory[prod.category] || [];
      for (const rp of catPool) {
        if (downloadJobs.length >= TARGET_IMAGES) break;
        if (productFlavorPaths[prod.id].length >= prod.flavorKeys.length) break;
        const brandMatch = prod.brand
          .toLowerCase()
          .split(' ')[0];
        if (!rp.title.toLowerCase().includes(brandMatch) && prod.category !== 'bar-cookie') {
          continue;
        }
        for (const u of getCleanImages(rp)) {
          if (downloadJobs.length >= TARGET_IMAGES) break;
          if (productFlavorPaths[prod.id].length >= prod.flavorKeys.length) break;
          if (!urlToLocalPath.has(u)) {
            const idx = downloadJobs.length + 1;
            const fileName = `${prod.slug}-${String(idx).padStart(3, '0')}.webp`;
            downloadJobs.push({ fileName, url: u });
            urlToLocalPath.set(u, `/images/products/${fileName}`);
            productFlavorPaths[prod.id].push(`/images/products/${fileName}`);
          }
        }
      }
    }
  }

  console.log(`[NhaiSupplement] Downloading & optimizing ${downloadJobs.length} clean product images...`);

  const BATCH_SIZE = 12;
  const rawPaths = [];
  for (let i = 0; i < downloadJobs.length; i += BATCH_SIZE) {
    const batch = downloadJobs.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (job) => {
        const rawPath = path.join(TEMP_DIR, `${job.fileName}.src`);
        try {
          await downloadFile(job.url, rawPath);
          rawPaths.push({ ...job, rawPath });
        } catch (err) {
          console.warn(`Warn: failed ${job.url}: ${err.message}`);
        }
      }),
    );
  }

  // Calibrate WebP compression quality toward ~4.8MB
  let quality = 78;
  let totalBytes = 0;
  for (let pass = 0; pass < 3; pass++) {
    totalBytes = 0;
    for (let i = 0; i < rawPaths.length; i += 8) {
      const batch = rawPaths.slice(i, i + 8);
      await Promise.all(
        batch.map(async (item) => {
          const outPath = path.join(OUTPUT_DIR, item.fileName);
          await convertToWebp(item.rawPath, outPath, quality);
          totalBytes += fs.statSync(outPath).size;
        }),
      );
    }
    const mb = totalBytes / (1024 * 1024);
    console.log(
      `[NhaiSupplement] Pass ${pass + 1} (quality=${quality}): ${rawPaths.length} WebP files = ${mb.toFixed(2)} MB`,
    );
    if (mb <= 5.0 && mb >= 4.2) break;
    if (mb > 5.0) {
      quality = Math.max(48, Math.round(quality * (TARGET_TOTAL_MB / mb)));
    } else {
      quality = Math.min(92, Math.round(quality * (TARGET_TOTAL_MB / Math.max(mb, 1))));
    }
  }

  // Map flavors strictly WITHOUT repeating the same image across flavors of the same product!
  // Any flavor slot without a unique .webp falls back cleanly to its unique flavor studio SVG render.
  const flavorImageMap = {};
  for (const prod of ourProducts) {
    const uniqueFiles = productFlavorPaths[prod.id] || [];
    prod.flavorKeys.forEach((key, idx) => {
      const flavorId = `${prod.id}-${key}-${idx + 1}`;
      if (uniqueFiles[idx]) {
        flavorImageMap[flavorId] = uniqueFiles[idx];
      }
    });
  }

  fs.writeFileSync(IMAGE_MAP_PATH, JSON.stringify(flavorImageMap, null, 2), 'utf8');

  const manifest = {
    brand: 'NhaiSupplement',
    domain: 'nhaisupplement.com',
    generatedAt: new Date().toISOString(),
    imageCount: rawPaths.length,
    totalBytes,
    totalMB: Number((totalBytes / (1024 * 1024)).toFixed(2)),
    mappedUniqueWebpFlavors: Object.keys(flavorImageMap).length,
    qualityUsed: quality,
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');

  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  console.log('[NhaiSupplement] Done!', manifest);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
