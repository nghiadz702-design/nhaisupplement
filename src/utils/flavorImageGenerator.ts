import type { ProductFlavor, ProductShape } from '../types/product';

export interface StudioArtworkParams {
  productName: string;
  brand: string;
  categoryName: string;
  weightLabel: string;
  shape: ProductShape;
  flavorName: string;
  colorHex: string;
  accentHex: string;
  highlightKey: string;
  highlightValue: string;
  viewAngle?: 'front' | 'angle' | 'detail';
  isPowder?: boolean;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates a crisp, zero-404 SVG data URI studio render unique to every product & flavor.
 * Changing flavor updates the label color band, flavor typography, geometric highlight, and specular sheen.
 */
export function buildFlavorStudioDataUri(params: StudioArtworkParams): string {
  const {
    productName,
    brand,
    categoryName,
    weightLabel,
    shape,
    flavorName,
    colorHex,
    accentHex,
    highlightKey,
    highlightValue,
    viewAngle = 'front',
    isPowder = true,
  } = params;

  const shortTitle = productName.length > 26 ? `${productName.slice(0, 24)}…` : productName;
  const shortFlavor = flavorName.length > 24 ? `${flavorName.slice(0, 22)}…` : flavorName;
  const angleShift = viewAngle === 'angle' ? -10 : viewAngle === 'detail' ? 8 : 0;

  let containerSvg = '';

  if (shape === 'tub' || shape === 'pouch') {
    containerSvg = `
      <g transform="translate(${200 + angleShift}, 182)">
        <!-- Ground contact shadow -->
        <ellipse cx="0" cy="126" rx="92" ry="14" fill="rgba(0,0,0,0.22)" />
        <!-- Neck & Matte Black Lid -->
        <rect x="-70" y="-128" width="140" height="24" rx="5" fill="#141414" stroke="#2D2D2D" stroke-width="1.5" />
        <rect x="-76" y="-134" width="152" height="14" rx="4" fill="#1F1F1F" />
        <line x1="-68" y1="-126" x2="68" y2="-126" stroke="#FF5A00" stroke-width="2" />
        <!-- Shoulder -->
        <path d="M-70,-104 C-86,-96 -92,-82 -92,-68 L92,-68 C92,-82 86,-96 70,-104 Z" fill="url(#bodyGrad)" />
        <!-- Main Cylinder Body -->
        <rect x="-92" y="-68" width="184" height="186" rx="14" fill="url(#bodyGrad)" />
        <!-- Flavor Label Wrap -->
        <rect x="-90" y="-44" width="180" height="128" fill="#0E0E0E" />
        <!-- Flavor Color Band -->
        <rect x="-90" y="-44" width="180" height="22" fill="${colorHex}" />
        <rect x="-90" y="64" width="180" height="20" fill="${accentHex}" opacity="0.92" />
        <!-- Studio Vertical Specular Highlight -->
        <rect x="-66" y="-100" width="22" height="214" rx="8" fill="url(#shineGrad)" opacity="0.32" />
        <!-- Typography on Tub Label -->
        <text x="0" y="-29" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" font-weight="800" fill="#FFFFFF" letter-spacing="1.6">${escapeXml(brand.toUpperCase())}</text>
        <text x="0" y="-2" text-anchor="middle" font-family="system-ui, sans-serif" font-size="13.5" font-weight="800" fill="#FFFFFF">${escapeXml(shortTitle)}</text>
        <text x="0" y="18" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#FF5A00">${escapeXml(highlightValue)} ${escapeXml(highlightKey)}</text>
        <rect x="-68" y="30" width="136" height="22" rx="4" fill="${colorHex}" fill-opacity="0.22" stroke="${colorHex}" stroke-width="1" />
        <text x="0" y="45" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10.5" font-weight="700" fill="#FFFFFF">${escapeXml(shortFlavor)}</text>
        <text x="0" y="78" text-anchor="middle" font-family="monospace" font-size="10" font-weight="700" fill="#FFFFFF">${escapeXml(weightLabel)}</text>
      </g>
    `;
  } else if (shape === 'bar') {
    containerSvg = `
      <g transform="translate(${200 + angleShift}, 188) rotate(${viewAngle === 'angle' ? -6 : -3})">
        <ellipse cx="4" cy="96" rx="126" ry="16" fill="rgba(0,0,0,0.18)" />
        <!-- Foil Wrapper Body -->
        <rect x="-128" y="-54" width="256" height="114" rx="10" fill="#121212" stroke="#262626" stroke-width="2" />
        <!-- Crimped Foil Ends -->
        <path d="M-142,-50 L-128,-54 L-128,60 L-142,56 Z" fill="#202020" />
        <path d="M142,-50 L128,-54 L128,60 L142,56 Z" fill="#202020" />
        <!-- Flavor Stripe Diagonal -->
        <polygon points="-128,-22 128,-46 128,-8 -128,16" fill="${colorHex}" />
        <polygon points="-128,36 128,18 128,60 -128,60" fill="${accentHex}" opacity="0.9" />
        <!-- Specular Shine -->
        <rect x="-120" y="-48" width="240" height="22" rx="4" fill="url(#shineGrad)" opacity="0.25" />
        <!-- Text -->
        <text x="-108" y="-29" font-family="system-ui, sans-serif" font-size="10" font-weight="800" fill="#FFFFFF" letter-spacing="1.5">${escapeXml(brand.toUpperCase())}</text>
        <text x="0" y="6" text-anchor="middle" font-family="system-ui, sans-serif" font-size="15" font-weight="800" fill="#FFFFFF">${escapeXml(shortTitle)}</text>
        <text x="0" y="28" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11.5" font-weight="700" fill="#FF5A00">${escapeXml(shortFlavor)}</text>
        <text x="0" y="51" text-anchor="middle" font-family="monospace" font-size="10" font-weight="700" fill="#FFFFFF">${escapeXml(highlightValue)} ${escapeXml(highlightKey)} · ${escapeXml(weightLabel)}</text>
      </g>
    `;
  } else {
    // Bottle (Vitamin / Fish Oil)
    containerSvg = `
      <g transform="translate(${200 + angleShift}, 188)">
        <ellipse cx="0" cy="118" rx="76" ry="13" fill="rgba(0,0,0,0.2)" />
        <!-- Cap -->
        <rect x="-44" y="-122" width="88" height="28" rx="4" fill="#181818" />
        <line x1="-44" y1="-98" x2="44" y2="-98" stroke="#FF5A00" stroke-width="2" />
        <!-- Neck & Bottle Body -->
        <path d="M-40,-94 C-58,-84 -66,-68 -66,-50 L66,-50 C66,-68 58,-84 40,-94 Z" fill="url(#amberGrad)" />
        <rect x="-66" y="-50" width="132" height="162" rx="14" fill="url(#amberGrad)" />
        <!-- Label -->
        <rect x="-64" y="-32" width="128" height="122" fill="#0E0E0E" />
        <rect x="-64" y="-32" width="128" height="18" fill="${colorHex}" />
        <rect x="-64" y="74" width="128" height="16" fill="${accentHex}" />
        <rect x="-48" y="-88" width="16" height="190" rx="6" fill="url(#shineGrad)" opacity="0.28" />
        <!-- Capsules accent -->
        <ellipse cx="74" cy="98" rx="16" ry="8" transform="rotate(-18 74 98)" fill="${colorHex}" stroke="#FFFFFF" stroke-opacity="0.4" stroke-width="1" />
        <ellipse cx="94" cy="108" rx="14" ry="7" transform="rotate(14 94 108)" fill="#FF9F1C" stroke="#FFFFFF" stroke-opacity="0.4" stroke-width="1" />
        <!-- Label Text -->
        <text x="0" y="-19" text-anchor="middle" font-family="system-ui, sans-serif" font-size="9" font-weight="800" fill="#FFFFFF" letter-spacing="1.4">${escapeXml(brand.toUpperCase())}</text>
        <text x="0" y="6" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" font-weight="800" fill="#FFFFFF">${escapeXml(shortTitle)}</text>
        <text x="0" y="27" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10.5" font-weight="700" fill="#FF5A00">${escapeXml(highlightValue)}</text>
        <text x="0" y="45" text-anchor="middle" font-family="system-ui, sans-serif" font-size="9.5" font-weight="600" fill="#D4D4D8">${escapeXml(shortFlavor)}</text>
        <text x="0" y="85" text-anchor="middle" font-family="monospace" font-size="9" font-weight="700" fill="#FFFFFF">${escapeXml(weightLabel)}</text>
      </g>
    `;
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 340" width="400" height="340">
      <defs>
        <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#F7F7F7" />
          <stop offset="100%" stop-color="#ECECEC" />
        </linearGradient>
        <radialGradient id="spotGrad" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stop-color="${colorHex}" stop-opacity="0.14" />
          <stop offset="100%" stop-color="${colorHex}" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#1A1A1A" />
          <stop offset="35%" stop-color="#2D2D2D" />
          <stop offset="100%" stop-color="#0D0D0D" />
        </linearGradient>
        <linearGradient id="amberGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#27190C" />
          <stop offset="40%" stop-color="#4A2D12" />
          <stop offset="100%" stop-color="#140C05" />
        </linearGradient>
        <linearGradient id="shineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.85" />
          <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
        </linearGradient>
      </defs>
      <rect width="400" height="340" fill="url(#bgGrad)" />
      <rect width="400" height="340" fill="url(#spotGrad)" />
      <!-- Pedestal Line -->
      <rect x="28" y="294" width="344" height="2" fill="#E0E0E0" />
      <!-- Top Corner Studio Tags -->
      <text x="20" y="26" font-family="monospace" font-size="10" font-weight="700" fill="#737373">${escapeXml(categoryName.toUpperCase())}</text>
      <text x="380" y="26" text-anchor="end" font-family="monospace" font-size="10" font-weight="700" fill="#FF5A00">${isPowder ? 'TẶNG BÌNH LẮC' : 'CHÍNH HÃNG'}</text>
      <!-- Flavor Color Dot Swatch -->
      <circle cx="24" cy="316" r="5" fill="${colorHex}" />
      <text x="36" y="320" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#171717">Vị: ${escapeXml(shortFlavor)}</text>
      <text x="380" y="320" text-anchor="end" font-family="monospace" font-size="10" font-weight="600" fill="#525252">nhaisupplement.com</text>
      ${containerSvg}
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function getFlavorThumbnailUrls(
  params: StudioArtworkParams,
  flavor: ProductFlavor,
): string[] {
  return [
    flavor.image,
    buildFlavorStudioDataUri({ ...params, viewAngle: 'angle' }),
    buildFlavorStudioDataUri({ ...params, viewAngle: 'detail' }),
  ];
}
