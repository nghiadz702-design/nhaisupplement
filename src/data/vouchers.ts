export interface VoucherRule {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minOrder: number;
  maxDiscount: number;
  title: string;
  description: string;
  active: boolean;
}

export const VOUCHERS: VoucherRule[] = [
  {
    code: 'NHAI10',
    type: 'percent',
    value: 10,
    minOrder: 500000,
    maxDiscount: 150000,
    title: 'Giảm 10%',
    description: 'Đơn từ 500.000đ · Giảm tối đa 150.000đ',
    active: true,
  },
  {
    code: 'NHAI100K',
    type: 'fixed',
    value: 100000,
    minOrder: 1500000,
    maxDiscount: 0,
    title: 'Giảm 100.000đ',
    description: 'Đơn từ 1.500.000đ · Áp dụng mọi danh mục',
    active: true,
  },
  {
    code: 'NHAI50K',
    type: 'fixed',
    value: 50000,
    minOrder: 600000,
    maxDiscount: 0,
    title: 'Giảm 50.000đ',
    description: 'Đơn từ 600.000đ · Áp dụng mọi danh mục',
    active: true,
  },
];

export interface VoucherEvaluation {
  valid: boolean;
  code: string;
  discount: number;
  message: string;
  rule?: VoucherRule;
}

export function evaluateVoucher(rawCode: string, subtotal: number): VoucherEvaluation {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    return { valid: false, code: '', discount: 0, message: '' };
  }

  const rule = VOUCHERS.find((v) => v.code === code && v.active);
  if (!rule) {
    return {
      valid: false,
      code,
      discount: 0,
      message: `Mã "${code}" không tồn tại hoặc đã hết hạn.`,
    };
  }

  if (subtotal < rule.minOrder) {
    return {
      valid: false,
      code,
      discount: 0,
      rule,
      message: `Đơn tối thiểu ${rule.minOrder.toLocaleString('vi-VN')}đ để dùng mã ${rule.code}.`,
    };
  }

  let discount = rule.type === 'percent' ? Math.round((subtotal * rule.value) / 100) : rule.value;
  if (rule.maxDiscount > 0) {
    discount = Math.min(discount, rule.maxDiscount);
  }
  discount = Math.min(discount, subtotal);

  return {
    valid: true,
    code: rule.code,
    discount,
    rule,
    message: `Đã áp dụng mã ${rule.code} (-${discount.toLocaleString('vi-VN')}đ).`,
  };
}
