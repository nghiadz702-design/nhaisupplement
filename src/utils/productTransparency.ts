import { formatVND } from '../data/catalog';
import type { Product, ProductFlavor } from '../types/product';

export interface RealPhysicalDimensions {
  widthCm: number;
  heightCm: number;
  depthCm: number;
  heightMeters: number;
  label: string;
}

export function getRealPhysicalDimensions(product: Product): RealPhysicalDimensions {
  const wLower = product.weightLabel.toLowerCase();

  if (product.shape === 'bar') {
    return {
      widthCm: 14,
      heightCm: 5,
      depthCm: 2.5,
      heightMeters: 0.055,
      label: '~ 14 × 5 × 2.5 cm',
    };
  }

  if (product.shape === 'bottle') {
    return {
      widthCm: 7,
      heightCm: 13,
      depthCm: 7,
      heightMeters: 0.13,
      label: '~ 13 × 7 cm',
    };
  }

  if (product.shape === 'pouch') {
    const isLarge = wLower.includes('10') || wLower.includes('12') || wLower.includes('15') || wLower.includes('5kg') || wLower.includes('6.8kg');
    const isSmall = wLower.includes('500g') || wLower.includes('300g') || wLower.includes('250g');
    const h = isLarge ? 38 : isSmall ? 22 : 30;
    const w = isLarge ? 25 : isSmall ? 16 : 22;
    const d = isLarge ? 11 : isSmall ? 7 : 10;
    return {
      widthCm: w,
      heightCm: h,
      depthCm: d,
      heightMeters: h / 100,
      label: `~ ${h} × ${w} × ${d} cm`,
    };
  }

  if (wLower.includes('10') || wLower.includes('12') || wLower.includes('5kg')) {
    return {
      widthCm: 21,
      heightCm: 32,
      depthCm: 21,
      heightMeters: 0.32,
      label: '~ 32 × 21 cm',
    };
  }

  if (wLower.includes('5lb') || wLower.includes('4.5lb') || wLower.includes('2.2kg')) {
    return {
      widthCm: 16,
      heightCm: 26,
      depthCm: 16,
      heightMeters: 0.26,
      label: '~ 26 × 16 cm',
    };
  }

  if (
    wLower.includes('2lb') ||
    wLower.includes('2.2lb') ||
    wLower.includes('900g') ||
    wLower.includes('1kg')
  ) {
    return {
      widthCm: 13,
      heightCm: 22,
      depthCm: 13,
      heightMeters: 0.22,
      label: '~ 22 × 13 cm',
    };
  }

  return {
    widthCm: 10,
    heightCm: 14,
    depthCm: 10,
    heightMeters: 0.14,
    label: '~ 14 × 10 cm',
  };
}

export function getRealSizeLabel(product: Product): string {
  return getRealPhysicalDimensions(product).label;
}

export interface ProductFactItem {
  label: string;
  value: string;
  accent?: boolean;
}

export interface ProductTransparencyInfo {
  manufacturer: string;
  manufacturerShort: string;
  origin: string;
  dosageForm: string;
  costPerServing: number;
  costPerServingLabel: string;
  keyFacts: ProductFactItem[];
  benefits: string[];
  usageSteps: string[];
  targetAudience: string;
  safetyCaution: string;
  storageNote: string;
  shelfLifeCommitment: string;
  authenticityNote: string;
}

const BRAND_ORIGIN_MAP: Record<string, string> = {
  'Optimum Nutrition': 'Mỹ (USA)',
  Dymatize: 'Mỹ (USA)',
  Mutant: 'Canada',
  BSN: 'Mỹ (USA)',
  Isopure: 'Mỹ (USA)',
  Nutrex: 'Mỹ (USA)',
  NutraBio: 'Mỹ (USA)',
  PVL: 'Canada',
  RYSE: 'Mỹ (USA)',
  'RAW Nutrition': 'Mỹ (USA)',
  MuscleMeds: 'Mỹ (USA)',
  Redcon1: 'Mỹ (USA)',
  'Perfect Sports': 'Canada',
  'Hi-Tech Pharma': 'Mỹ (USA)',
  'VMI Sports': 'Mỹ (USA)',
  'Jocko Fuel': 'Mỹ (USA)',
  'Axe & Sledge': 'Mỹ (USA)',
  OstroVit: 'Ba Lan (Châu Âu)',
  'CON-CRET': 'Mỹ (USA)',
  'BPI Sports': 'Mỹ (USA)',
  'Applied Nutrition': 'Anh Quốc (UK)',
  Barebells: 'Thụy Điển (Châu Âu)',
  'Legendary Foods': 'Mỹ (USA)',
  'Quest Nutrition': 'Mỹ (USA)',
  'Bucked Up': 'Mỹ (USA)',
  Cellucor: 'Mỹ (USA)',
  PANDA: 'Mỹ (USA)',
  'Project#1': 'Mỹ (USA)',
  Xtend: 'Mỹ (USA)',
  Codeage: 'Mỹ (USA)',
  Blackmores: 'Úc (Australia)',
  'Sports Research': 'Mỹ (USA)',
  'NOW Foods': 'Mỹ (USA)',
  Goodhealth: 'New Zealand',
};

const BRAND_MANUFACTURER_MAP: Record<string, { full: string; short: string }> = {
  'Optimum Nutrition': {
    full: 'Optimum Nutrition, Inc. (Tập đoàn Glanbia Performance Nutrition, Illinois, USA)',
    short: 'Optimum Nutrition, Inc. (USA)',
  },
  Dymatize: {
    full: 'Dymatize Enterprises, LLC (BellRing Brands, Dallas, Texas, USA)',
    short: 'Dymatize Enterprises, LLC (USA)',
  },
  Mutant: {
    full: 'Fit Foods Ltd. / Mutant Nutrition (Port Coquitlam, British Columbia, Canada)',
    short: 'Fit Foods Ltd. (Canada)',
  },
  BSN: {
    full: 'Bio-Engineered Supplements and Nutrition, Inc. (Glanbia, Downers Grove, USA)',
    short: 'Bio-Engineered Supplements, Inc. (USA)',
  },
  Isopure: {
    full: 'The Isopure Company, LLC (Glanbia Performance Nutrition, New York, USA)',
    short: 'The Isopure Company, LLC (USA)',
  },
  Nutrex: {
    full: 'Nutrex Research, Inc. (Oviedo, Florida, USA)',
    short: 'Nutrex Research, Inc. (USA)',
  },
  NutraBio: {
    full: 'NutraBio Labs, Inc. (Middlesex, New Jersey, USA)',
    short: 'NutraBio Labs, Inc. (USA)',
  },
  PVL: {
    full: 'Pure Vita Labs / Fit Foods Ltd. (British Columbia, Canada)',
    short: 'Pure Vita Labs Ltd. (Canada)',
  },
  RYSE: {
    full: 'RYSE Up Sports Nutrition, LLC (Prosper, Texas, USA)',
    short: 'RYSE Up Sports Nutrition, LLC (USA)',
  },
  'RAW Nutrition': {
    full: 'RAW Nutrition Supplements, LLC (Port St. Lucie, Florida, USA)',
    short: 'RAW Nutrition Supplements, LLC (USA)',
  },
  MuscleMeds: {
    full: 'MuscleMeds Performance Technologies / MHP (West Caldwell, New Jersey, USA)',
    short: 'MuscleMeds Performance Tech (USA)',
  },
  Redcon1: {
    full: 'Redcon1, LLC (Boca Raton, Florida, USA)',
    short: 'Redcon1, LLC (USA)',
  },
  'Perfect Sports': {
    full: 'Perfect Sports Nutrition Inc. (Vaughan, Ontario, Canada)',
    short: 'Perfect Sports Nutrition Inc. (Canada)',
  },
  'Hi-Tech Pharma': {
    full: 'Hi-Tech Pharmaceuticals, Inc. (Norcross, Georgia, USA)',
    short: 'Hi-Tech Pharmaceuticals, Inc. (USA)',
  },
  'VMI Sports': {
    full: 'VMI Sports, LLC (Long Island, New York, USA)',
    short: 'VMI Sports, LLC (USA)',
  },
  'Jocko Fuel': {
    full: 'Jocko Fuel, LLC (Wilton, Maine, USA)',
    short: 'Jocko Fuel, LLC (USA)',
  },
  'Axe & Sledge': {
    full: 'Axe & Sledge Supplements, LLC (Homestead, Pennsylvania, USA)',
    short: 'Axe & Sledge Supplements, LLC (USA)',
  },
  OstroVit: {
    full: 'OstroVit Sp. z o.o. (Zambrów, Podlaskie, Ba Lan)',
    short: 'OstroVit Sp. z o.o. (Ba Lan)',
  },
  'CON-CRET': {
    full: 'ProMera Health, LLC (Omaha, Nebraska, USA)',
    short: 'ProMera Health, LLC (USA)',
  },
  'BPI Sports': {
    full: 'BPI Sports, LLC (Hollywood, Florida, USA)',
    short: 'BPI Sports, LLC (USA)',
  },
  'Applied Nutrition': {
    full: 'Applied Nutrition Plc (Knowsley, Liverpool, Anh Quốc)',
    short: 'Applied Nutrition Plc (UK)',
  },
  Barebells: {
    full: 'Barebells Functional Foods AB (Stockholm, Thụy Điển)',
    short: 'Barebells Functional Foods AB (Thụy Điển)',
  },
  'Legendary Foods': {
    full: 'Legendary Foods, LLC (Woodland Hills, California, USA)',
    short: 'Legendary Foods, LLC (USA)',
  },
  'Quest Nutrition': {
    full: 'Quest Nutrition, LLC (El Segundo, California, USA)',
    short: 'Quest Nutrition, LLC (USA)',
  },
  'Bucked Up': {
    full: 'DAS Labs, LLC / Bucked Up (Orem, Utah, USA)',
    short: 'DAS Labs, LLC (USA)',
  },
  Cellucor: {
    full: 'Woodbolt Distribution, LLC / Nutrabolt (Austin, Texas, USA)',
    short: 'Nutrabolt / Woodbolt LLC (USA)',
  },
  PANDA: {
    full: 'Panda Supplements, LLC (New York, USA)',
    short: 'Panda Supplements, LLC (USA)',
  },
  'Project#1': {
    full: 'Project#1 Nutrition, LLC (USA)',
    short: 'Project#1 Nutrition, LLC (USA)',
  },
  Xtend: {
    full: 'Scivation, Inc. / Nutrabolt (Austin, Texas, USA)',
    short: 'Scivation, Inc. / Nutrabolt (USA)',
  },
  Codeage: {
    full: 'Codeage, LLC (Los Angeles, California, USA)',
    short: 'Codeage, LLC (USA)',
  },
  Blackmores: {
    full: 'Blackmores Limited (Warriewood, New South Wales, Úc)',
    short: 'Blackmores Limited (Úc)',
  },
  'Sports Research': {
    full: 'Sports Research Corp. (San Pedro, California, USA)',
    short: 'Sports Research Corp. (USA)',
  },
  'NOW Foods': {
    full: 'NOW Health Group, Inc. (Bloomingdale, Illinois, USA)',
    short: 'NOW Health Group, Inc. (USA)',
  },
  Goodhealth: {
    full: 'Good Health Products Ltd. (Auckland, New Zealand)',
    short: 'Good Health Products Ltd. (NZ)',
  },
};

function detectDosageForm(product: Product): string {
  if (product.category === 'bar-cookie') return 'Thanh bánh protein ăn liền';
  if (product.category === 'dau-ca') return 'Viên nang mềm (Softgel)';
  if (product.category === 'vitamin') {
    const combined = `${product.name} ${product.shortDescription}`.toLowerCase();
    if (combined.includes('d3') || combined.includes('mct') || combined.includes('a-d3')) {
      return 'Viên nang mềm hòa tan dầu (Softgel)';
    }
    if (combined.includes('liposomal') || combined.includes('caps')) {
      return 'Viên nang thực vật (Capsules)';
    }
    return 'Viên nén / Viên nang uống trực tiếp';
  }
  if (product.category === 'creatine') {
    return product.shape === 'pouch' ? 'Bột siêu mịn (Túi zip)' : 'Bột siêu mịn dễ hòa tan';
  }
  return product.shape === 'pouch' ? 'Bột hòa tan mịn (Túi zip)' : 'Bột hòa tan mịn (Powder)';
}

function buildSpecificBenefits(product: Product, textLower: string): string[] {
  const nut = product.nutritionInfo;

  switch (product.category) {
    case 'whey-hydrolyzed':
      if (textLower.includes('beef') || textLower.includes('carnivor')) {
        return [
          `Cung cấp ${nut.protein} đạm bò thủy phân tinh khiết giúp xây dựng cơ bắp săn chắc.`,
          'Hoàn toàn không chứa sữa & lactose, thân thiện với người dị ứng sữa bò.',
          'Hỗ trợ phục hồi sợi cơ nhanh chóng sau các buổi tập nặng.',
        ];
      }
      if (textLower.includes('hydro') || textLower.includes('iso 100') || textLower.includes('100')) {
        return [
          `Bổ sung ${nut.protein} Whey thủy phân / Isolate siêu tinh khiết hấp thu nhanh trong 15–30 phút.`,
          'Giảm thiểu tối đa chất béo, đường và lactose, hỗ trợ tăng cơ nạc rõ nét.',
          'Bổ sung chuỗi axit amin BCAA & EAA tự nhiên chống dị hóa cơ sau tập.',
        ];
      }
      return [
        `Cung cấp ${nut.protein} Protein chất lượng cao (${nut.highlightKey}: ${nut.highlightValue}) mỗi khẩu phần.`,
        'Kích thích tổng hợp Protein cơ bắp, rút ngắn thời gian đau mỏi sau khi tập.',
        'Thay thế bữa phụ tiện lợi, ít calo thừa giúp kiểm soát mỡ hiệu quả.',
      ];

    case 'mass':
      return [
        `Cung cấp ${nut.calories} năng lượng dồi dào cùng ${nut.protein} Protein giúp người gầy tăng cân bền vững.`,
        'Bổ sung nguồn tinh bột phức hợp giải phóng năng lượng ổn định suốt cả ngày.',
        'Hỗ trợ tăng kích thước cơ bắp và cân nặng khi kết hợp tập kháng lực.',
      ];

    case 'creatine':
      return [
        `Bổ sung ${nut.highlightValue} Creatine giúp tái tạo năng lượng tế bào (ATP) tức thì khi tập nặng.`,
        'Tăng sức mạnh bùng nổ (tăng mức tạ, số rep đẩy) và cải thiện sức bền cơ bắp.',
        textLower.includes('hcl')
          ? 'Dạng Creatine HCl hòa tan vượt trội, không gây giữ nước dưới da hay nặng bụng.'
          : 'Hỗ trợ giữ nước nội bào giúp cơ bắp căng phồng và phục hồi nhanh giữa các hiệp.',
      ];

    case 'pre-workout':
      return [
        'Tăng sự tỉnh táo, tập trung thần kinh cao độ và xua tan uể oải trước buổi tập.',
        'Thúc đẩy giãn mạch, bơm máu tối đa vào cơ bắp nhờ tổ hợp hoạt chất Citrulline / Pump.',
        'Kéo dài sức bền, giảm tích tụ axit lactic để bạn đẩy thêm nhiều hiệp nặng.',
      ];

    case 'eaa':
      return [
        `Cung cấp đầy đủ 9 axit amin thiết yếu (${nut.highlightValue}) cơ thể không tự tổng hợp được.`,
        'Ngăn ngừa dị hóa (mất cơ) và bù điện giải tức thì trong suốt buổi tập cường độ cao.',
        'Không chứa chất kích thích, dùng thoải mái khi tập sáng sớm hoặc tối muộn.',
      ];

    case 'bcaa':
      return [
        `Cung cấp ${nut.highlightValue} chuỗi nhánh Leucine - Isoleucine - Valine bảo vệ mô cơ tối đa.`,
        'Giảm rõ rệt cảm giác đau nhức cơ bắp (DOMS) sau các buổi tập nặng.',
        'Hỗ trợ bù nước và duy trì sức bền khi tập cardio hoặc tập tạ kéo dài.',
      ];

    case 'bar-cookie':
      return [
        `Nạp nhanh ${nut.protein} Protein tiện lợi mọi lúc mọi nơi mà không cần pha chế.`,
        'Kiểm soát cơn thèm ngọt nhờ hàm lượng đường thấp, phù hợp cả khi ăn kiêng giảm mỡ.',
        'Làm bữa phụ lý tưởng trước tập 45 phút, sau tập hoặc tại văn phòng.',
      ];

    case 'dau-ca':
      return [
        `Bổ sung ${nut.highlightValue} axit béo thiết yếu EPA & DHA tinh khiết hỗ trợ bảo vệ tim mạch.`,
        'Giảm viêm khớp, bôi trơn sụn khớp cho người tập tạ nặng và vận động thường xuyên.',
        'Hỗ trợ tăng cường thị lực, trí nhớ và khả năng tập trung não bộ.',
      ];

    case 'vitamin':
    default:
      if (textLower.includes('zma') || textLower.includes('magtein') || textLower.includes('glycinate')) {
        return [
          'Làm dịu hệ thần kinh trung ương, giúp dễ vào giấc và ngủ sâu giấc hơn.',
          'Thúc đẩy quá trình phục hồi cơ bắp và tái tạo năng lượng vào ban đêm.',
          'Hỗ trợ giảm tình trạng chuột rút, căng thẳng cơ bắp sau ngày tập mệt.',
        ];
      }
      if (textLower.includes('d3') || textLower.includes('k2') || textLower.includes('calcium')) {
        return [
          'Tăng cường hấp thu Canxi và vận chuyển trực tiếp vào xương giúp xương khớp chắc khỏe.',
          'Hỗ trợ hệ miễn dịch khỏe mạnh và duy trì nội tiết tố ổn định cho người tập gym.',
          'Hạn chế tình trạng lắng đọng canxi nhờ cơ chế phối hợp chuẩn D3 + K2 MK-7.',
        ];
      }
      if (textLower.includes('zinc') || textLower.includes('oyster')) {
        return [
          'Bổ sung Kẽm sinh học hỗ trợ tăng sức đề kháng và giảm mệt mỏi.',
          'Hỗ trợ sản sinh testosterone tự nhiên, cải thiện sinh lực nam giới và phục hồi cơ.',
          'Giúp làm đẹp da, giảm mụn và hỗ trợ trao đổi chất hiệu quả.',
        ];
      }
      if (textLower.includes('vit c') || textLower.includes('bio c') || textLower.includes('liposomal')) {
        return [
          `Cung cấp ${nut.highlightValue} Vitamin C giúp nâng cao hệ miễn dịch và phòng ngừa cảm cúm.`,
          'Chống oxy hóa mạnh mẽ, bảo vệ tế bào trước gốc tự do sinh ra khi tập luyện nặng.',
          'Kích thích tổng hợp Collagen tự nhiên giúp gân, dây chằng và làn da khỏe mạnh.',
        ];
      }
      return [
        'Bù đắp đầy đủ vitamin và khoáng chất thiết yếu thiếu hụt trong thực đơn hàng ngày.',
        'Tăng cường chuyển hóa năng lượng, hỗ trợ sức đề kháng và giảm suy nhược.',
        'Giúp cơ thể hấp thu Protein và dinh dưỡng từ thức ăn đạt hiệu quả tối ưu.',
      ];
  }
}

export function getProductTransparencyInfo(
  product: Product,
  flavor?: ProductFlavor,
): ProductTransparencyInfo {
  const origin = BRAND_ORIGIN_MAP[product.brand] ?? 'Nhập khẩu chính hãng';
  const manufacturerEntry = BRAND_MANUFACTURER_MAP[product.brand] ?? {
    full: `${product.brand} Official Manufacturer`,
    short: product.brand,
  };
  const dosageForm = detectDosageForm(product);
  const activePrice = flavor?.priceOverride ?? product.price;
  const servings = Math.max(1, product.nutritionInfo.servingsPerContainer);
  const costPerServing = Math.round(activePrice / servings);
  const costPerServingLabel = `~${formatVND(costPerServing)} / lần`;
  const nut = product.nutritionInfo;

  let keyFacts: ProductFactItem[];

  if (
    product.category === 'whey-hydrolyzed' ||
    product.category === 'mass' ||
    product.category === 'bar-cookie'
  ) {
    keyFacts = [
      { label: 'Khẩu phần', value: nut.servingSize },
      { label: 'Số lần dùng', value: `${nut.servingsPerContainer} lần` },
      { label: 'Năng lượng', value: nut.calories },
      { label: 'Protein', value: nut.protein, accent: true },
      { label: 'Carbs / Fat', value: `${nut.carbs} / ${nut.fat}` },
      { label: nut.highlightKey || 'Điểm nổi bật', value: nut.highlightValue, accent: true },
    ];
  } else if (product.category === 'creatine') {
    keyFacts = [
      { label: nut.highlightKey || 'Hàm lượng', value: nut.highlightValue, accent: true },
      { label: 'Khẩu phần chuẩn', value: nut.servingSize },
      { label: 'Số lần dùng', value: `${nut.servingsPerContainer} lần` },
      { label: 'Chi phí / ngày', value: costPerServingLabel, accent: true },
      { label: 'Độ tinh khiết', value: 'Không đường · 0 Calo' },
      { label: 'Kích thước hộp', value: getRealSizeLabel(product) },
    ];
  } else if (
    product.category === 'pre-workout' ||
    product.category === 'eaa' ||
    product.category === 'bcaa'
  ) {
    keyFacts = [
      { label: nut.highlightKey || 'Hoạt chất chính', value: nut.highlightValue, accent: true },
      { label: 'Khẩu phần', value: nut.servingSize },
      { label: 'Số lần dùng', value: `${nut.servingsPerContainer} lần` },
      { label: 'Chi phí / lần', value: costPerServingLabel, accent: true },
      { label: 'Năng lượng / Carb', value: `${nut.calories} · ${nut.carbs}` },
      { label: 'Kích thước hộp', value: getRealSizeLabel(product) },
    ];
  } else {
    keyFacts = [
      { label: nut.highlightKey || 'Hàm lượng chính', value: nut.highlightValue, accent: true },
      { label: 'Liều khuyến nghị', value: nut.servingSize },
      { label: 'Số ngày dùng', value: `${nut.servingsPerContainer} lần` },
      { label: 'Chi phí / lần', value: costPerServingLabel, accent: true },
      { label: 'Dạng bào chế', value: dosageForm.split(' (')[0] },
      { label: 'Quy cách hộp', value: product.weightLabel },
    ];
  }

  let usageSteps: string[] = [];
  let targetAudience = '';
  let safetyCaution = '';
  let storageNote =
    'Đậy kín nắp ngay sau khi sử dụng. Bảo quản nơi khô ráo, thoáng mát (dưới 25–28°C), tránh ánh nắng trực tiếp và xa tầm tay trẻ em.';

  const textLower = `${product.name} ${product.shortDescription} ${product.description}`.toLowerCase();
  const benefits = buildSpecificBenefits(product, textLower);

  switch (product.category) {
    case 'whey-hydrolyzed':
      usageSteps = [
        `Pha 1 khẩu phần (${nut.servingSize}) với 250–300ml nước lọc mát hoặc sữa tươi không đường (không pha nước nóng/sôi để tránh vón cục biến tính đạm).`,
        'Thời điểm tốt nhất: Uống ngay trong vòng 30 phút sau khi kết thúc buổi tập, hoặc dùng vào buổi sáng sau khi thức dậy.',
        'Dùng 1–2 lần/ngày tùy mục tiêu tổng lượng Protein cá nhân.',
      ];
      targetAudience =
        'Người tập gym, thể thao muốn tăng cơ nạc, phục hồi nhanh và bổ sung đạm tinh khiết ít béo.';
      safetyCaution = textLower.includes('beef') || textLower.includes('zero') || textLower.includes('isolate')
        ? 'Hàm lượng lactose rất thấp hoặc không sữa động vật, phù hợp cả với người dễ nhạy cảm tiêu hóa nhẹ.'
        : 'Chứa nguồn đạm từ sữa bò (whey); người dị ứng sữa nặng nên cân nhắc dùng whey isolate tinh khiết hoặc đạm bò thủy phân.';
      break;

    case 'mass':
      usageSteps = [
        `Pha 1 khẩu phần chuẩn (${nut.servingSize}) với 500–700ml nước lạnh hoặc sữa. Nếu mới dùng, nên chia làm 2 lần pha (mỗi lần nửa khẩu phần) để bụng dễ làm quen.`,
        'Thời điểm khuyên dùng: Giữa các bữa chính (sáng–trưa hoặc trưa–tối) và ngay sau buổi tập.',
        'Kết hợp ăn đủ 3 bữa chính và tập kháng lực đều đặn để calo chuyển hóa vào cơ nạc.',
      ];
      targetAudience =
        'Người gầy lâu năm, người tập tạ khó tăng cân hoặc cần nguồn calo sạch để phát triển thể hình.';
      safetyCaution =
        'Không nên uống ngay sát bữa ăn chính (tránh no ngang bụng) và người tiểu đường cần theo dõi tổng lượng carb nạp vào.';
      break;

    case 'creatine':
      usageSteps = [
        `Pha 1 khẩu phần (${nut.servingSize}) với 200–300ml nước lọc, nước trái cây hoặc pha chung vào bình Whey / EAA.`,
        'Uống đều đặn mỗi ngày 1 lần vào cùng khung giờ cố định (kể cả ngày không tập) để duy trì dự trữ Creatine bão hòa.',
        'Uống đủ tối thiểu 2.5–3 lít nước lọc mỗi ngày trong quá trình bổ sung.',
      ];
      targetAudience =
        'Người tập tạ, chạy nước rút, thể thao đối kháng muốn tăng sức mạnh đẩy tạ và hiệu suất lặp lại.';
      safetyCaution =
        'Không chứa chất kích thích, dùng được mọi lúc trong ngày. Người có tiền sử bệnh lý thận nên hỏi ý kiến bác sĩ trước khi sử dụng.';
      break;

    case 'pre-workout': {
      const hasHighStim =
        textLower.includes('320mg') ||
        textLower.includes('400mg') ||
        textLower.includes('333mg') ||
        textLower.includes('high');
      usageSteps = [
        `Pha 1 khẩu phần (${nut.servingSize}) với 250–350ml nước lạnh, lắc tan đều và uống trước buổi tập 20–30 phút.`,
        hasHighStim
          ? 'Người mới làm quen nên bắt đầu với 1/2 muỗng trong 3–5 buổi đầu để cơ thể thích nghi hàm lượng Caffeine cao và cảm giác râm ran nhẹ của Beta-Alanine.'
          : 'Uống từng ngụm vừa phải trước khi khởi động 20 phút để đạt độ tỉnh táo và bơm cơ tối ưu.',
        'Không dùng chung với cà phê hoặc nước tăng lực khác trong cùng ngày tập.',
      ];
      targetAudience =
        'Người tập luyện buổi sáng/chiều cần tăng sự tập trung, sức bền và khả năng bơm máu vào cơ.';
      safetyCaution =
        'Chứa Caffeine & Beta-Alanine (có thể gây châm chích nhẹ ngoài da — phản ứng bình thường). Không uống trong vòng 5–6 giờ trước khi ngủ; không dùng cho người dưới 18 tuổi, phụ nữ mang thai hoặc người nhạy cảm tim mạch/huyết áp.';
      break;
    }

    case 'eaa':
    case 'bcaa':
      usageSteps = [
        `Pha 1 khẩu phần (${nut.servingSize}) với 400–600ml nước lạnh (lắc đều với đá viên uống rất ngon).`,
        'Uống rải đều từng ngụm nhỏ xuyên suốt buổi tập (Intra-Workout) để bù nước, bù điện giải và chống dị hóa cơ.',
        'Có thể dùng khi tập cardio buổi sáng bụng đói hoặc thay thế nước giải khát hàng ngày.',
      ];
      targetAudience =
        'Người tập cường độ cao, tập kéo dài trên 60 phút, đổ nhiều mồ hôi hoặc người đang cắt mỡ giữ cơ.';
      safetyCaution =
        'Không chứa caffeine, sử dụng an toàn ngay cả khi tập luyện buổi tối muộn mà không gây mất ngủ.';
      break;

    case 'bar-cookie':
      usageSteps = [
        `Bóc vỏ ăn trực tiếp ${nut.servingSize} mà không cần pha nước hay chế biến.`,
        'Dùng làm bữa phụ trước tập 45–60 phút, sau buổi tập hoặc mang theo đi làm, du lịch.',
        'Uống kèm thêm nước lọc để cơ thể tiêu hóa lượng chất xơ và protein trong bánh tốt nhất.',
      ];
      storageNote =
        'Bảo quản nơi khô thoáng mát dưới 25°C (tránh ánh nắng hoặc cốp xe nóng làm mềm chảy lớp phủ socola).';
      targetAudience =
        'Người bận rộn cần nạp nhanh 15–20g protein sạch mọi lúc, hoặc người ăn kiêng muốn thay thế đồ ngọt nhiều đường.';
      safetyCaution =
        'Sản phẩm có thể chứa sữa, đậu nành hoặc các loại hạt; kiểm tra kỹ bảng dị ứng trên bao bì nếu bạn có cơ địa dị ứng thực phẩm.';
      break;

    case 'dau-ca':
      usageSteps = [
        `Uống trực tiếp ${nut.servingSize} với nước lọc, TỐT NHẤT là dùng ngay trong hoặc sau bữa ăn chính có chất béo (bữa trưa hoặc bữa tối) để Omega-3 hấp thu tối ưu.`,
        'Nuốt nguyên viên nang mềm, không nhai hay cắn vỡ vỏ nang.',
        'Duy trì dùng đều đặn mỗi ngày để đạt hiệu quả lâu dài cho tim mạch và khớp.',
      ];
      targetAudience =
        'Người tập tạ nặng cần bảo vệ khớp, dân văn phòng ít ăn cá biển, người muốn chăm sóc tim mạch, mắt và trí não.';
      safetyCaution =
        'Người chuẩn bị phẫu thuật hoặc đang sử dụng thuốc chống đông máu cần tham khảo ý kiến bác sĩ trước khi dùng liều cao Omega-3.';
      break;

    case 'vitamin':
    default:
      usageSteps = textLower.includes('ngủ') || textLower.includes('zma') || textLower.includes('magnesium') || textLower.includes('magtein')
        ? [
            `Uống trực tiếp ${nut.servingSize} với nước lọc vào buổi tối, trước khi đi ngủ 30–60 phút.`,
            textLower.includes('zma')
              ? 'Tránh uống cùng lúc với sữa, Whey hoặc thực phẩm giàu Canxi vì Canxi cạnh tranh hấp thu Kẽm và Magie.'
              : 'Duy trì đều đặn mỗi tối giúp hệ thần kinh thư giãn và nâng cao chất lượng giấc ngủ sâu.',
            'Không tự ý dùng vượt quá liều khuyến nghị hàng ngày.',
          ]
        : [
            `Uống trực tiếp ${nut.servingSize} với nhiều nước lọc ngay sau bữa ăn sáng hoặc bữa ăn chính trong ngày.`,
            textLower.includes('d3') || textLower.includes('a-d3')
              ? 'Vì là vitamin tan trong dầu, bắt buộc uống ngay sau bữa ăn có chất béo (trứng, thịt, cá, bơ...) để hấp thu tối đa.'
              : 'Dùng đều đặn hàng ngày giúp bù đắp vi chất cho cơ thể vận động cường độ cao.',
            'Không tự ý dùng vượt quá liều lượng khuyến nghị trên bao bì nhà sản xuất.',
          ];
      targetAudience =
        'Người tập luyện thể thao, người làm việc căng thẳng hoặc người có chế độ ăn thiếu hụt vitamin & khoáng chất thiết yếu.';
      safetyCaution =
        'Thực phẩm bổ sung không phải là thuốc chữa bệnh. Phụ nữ đang mang thai, cho con bú hoặc đang điều trị bệnh lý nên tham khảo ý kiến chuyên gia y tế.';
      break;
  }

  return {
    manufacturer: manufacturerEntry.full,
    manufacturerShort: manufacturerEntry.short,
    origin,
    dosageForm,
    costPerServing,
    costPerServingLabel,
    keyFacts,
    benefits,
    usageSteps,
    targetAudience,
    safetyCaution,
    storageNote,
    shelfLifeCommitment: 'Date mới 12–24 tháng · Kiểm tra HSD & tem seal trước khi thanh toán',
    authenticityNote: 'Hàng chính hãng nguyên seal · Kho Hà Nội (Đống Đa) giao toàn quốc',
  };
}

