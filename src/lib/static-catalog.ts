/**
 * Fix #27: Single source of truth for static catalog items shown in HomeScreen,
 * ServicesScreen, and WishlistScreen. Import from here instead of duplicating data.
 */

const S3_BASE = 'https://anjanilaundry.s3.ap-south-2.amazonaws.com';

export interface StaticCatalogItem {
  id: string;
  name: string;
  category: string;
  /** Category slug used in ServicesScreen / HomeScreen tab filters */
  categorySlug: string;
  serviceType: string;
  tat: string;
  price: number;
  unit: string;
  imageUrl: string;
  description: string;
}

export const STATIC_CATALOG_ITEMS: StaticCatalogItem[] = [
  // ── MEN'S WEAR ──
  {
    id: 'men-1',
    name: "Men's Formal Shirt",
    category: "Men's Wear",
    categorySlug: 'mens-wear',
    serviceType: 'Steam Press & Fold',
    tat: '24H',
    price: 99,
    unit: 'pc',
    imageUrl: `${S3_BASE}/garments/cloth-shirt.jpg`,
    description: 'Crisp collar shaping, zero-bleed steam pressing, and wrinkle-free hanger packaging.',
  },
  {
    id: 'men-2',
    name: '2-Piece Executive Suit',
    category: "Men's Wear",
    categorySlug: 'mens-wear',
    serviceType: 'Ozone Dry Clean',
    tat: '48H',
    price: 349,
    unit: 'set',
    imageUrl: `${S3_BASE}/garments/cloth-suit-2p.jpg`,
    description: 'Blazer & trouser fabric sanitization, anti-moth treatment, and dust-proof garment bag.',
  },
  {
    id: 'men-3',
    name: 'Denim Jeans & Trousers',
    category: "Men's Wear",
    categorySlug: 'mens-wear',
    serviceType: 'Deep Clean & Press',
    tat: '24H',
    price: 119,
    unit: 'pc',
    imageUrl: `${S3_BASE}/garments/cloth-jeans.jpg`,
    description: 'Enzyme stain removal, color lock treatment, and heavy steam press.',
  },
  {
    id: 'men-4',
    name: 'Traditional Silk Kurta',
    category: "Men's Wear",
    categorySlug: 'mens-wear',
    serviceType: 'Charak Polish & Steam',
    tat: '48H',
    price: 189,
    unit: 'pc',
    imageUrl: `${S3_BASE}/garments/cloth-sherwani.jpg`,
    description: 'Gentle organic wash, zari preservation, and smooth roll press.',
  },

  // ── WOMEN'S WEAR ──
  {
    id: 'women-1',
    name: 'Pure Kanjeevaram Saree',
    category: "Women's Wear",
    categorySlug: 'womens-wear',
    serviceType: 'Charak Polish & Roll Press',
    tat: '48H',
    price: 249,
    unit: 'pc',
    imageUrl: `${S3_BASE}/garments/cloth-saree-silk.jpg`,
    description: 'Traditional starch roll finishing, zero-wrinkle wooden roll packaging.',
  },
  {
    id: 'women-2',
    name: 'Designer Anarkali Suit',
    category: "Women's Wear",
    categorySlug: 'womens-wear',
    serviceType: 'Gentle Ozone Dry Clean',
    tat: '48H',
    price: 299,
    unit: 'pc',
    imageUrl: `${S3_BASE}/garments/cloth-salwar.jpg`,
    description: 'Hand cleaning for stones, sequins, embroidery, and delicate dupatta.',
  },
  {
    id: 'women-3',
    name: 'Embroidered Kurti',
    category: "Women's Wear",
    categorySlug: 'womens-wear',
    serviceType: 'Steam Iron & Sanitize',
    tat: '24H',
    price: 89,
    unit: 'pc',
    imageUrl: `${S3_BASE}/garments/cloth-kurti.jpg`,
    description: 'Everyday gentle wash, anti-bacterial steam press, and soft fold.',
  },
  {
    id: 'women-4',
    name: 'Western Evening Gown',
    category: "Women's Wear",
    categorySlug: 'womens-wear',
    serviceType: 'Premium Fabric Spa',
    tat: '48H',
    price: 399,
    unit: 'pc',
    imageUrl: `${S3_BASE}/garments/cloth-gown.jpg`,
    description: 'Chiffon, satin, and velvet specialized treatment with moisture barrier bag.',
  },

  // ── BRIDAL / PREMIUM ──
  {
    id: 'bridal-1',
    name: 'Royal Bridal Lehenga Set',
    category: 'Premium Bridal',
    categorySlug: 'premium-bridal',
    serviceType: 'Hand Spa & Zero-Bleed Wash',
    tat: '72H',
    price: 899,
    unit: 'set',
    imageUrl: `${S3_BASE}/garments/cloth-lehenga.jpg`,
    description: 'Museum-grade preservation, individual stone inspection, and bridal box packing.',
  },
  {
    id: 'bridal-2',
    name: 'Groom Silk Sherwani',
    category: 'Premium Bridal',
    categorySlug: 'premium-bridal',
    serviceType: 'Stain Treatment & Steam',
    tat: '48H',
    price: 599,
    unit: 'set',
    imageUrl: `${S3_BASE}/garments/cloth-sherwani.jpg`,
    description: 'Velvet stole & safa detailing, high-pressure steam, and rigid hanger support.',
  },
  {
    id: 'bridal-3',
    name: 'Heavy Zari Banarasi Saree',
    category: 'Premium Bridal',
    categorySlug: 'premium-bridal',
    serviceType: 'Charak Roll & Packaging',
    tat: '48H',
    price: 349,
    unit: 'pc',
    imageUrl: `${S3_BASE}/garments/cloth-saree-silk.jpg`,
    description: 'Shine restoration, gold thread brightening, and acid-free tissue wrapping.',
  },
  {
    id: 'bridal-4',
    name: 'Pashmina / Cashmere Shawl',
    category: 'Premium Bridal',
    categorySlug: 'premium-bridal',
    serviceType: 'Gentle Woolen Dry Clean',
    tat: '48H',
    price: 279,
    unit: 'pc',
    imageUrl: `${S3_BASE}/garments/cloth-blanket-single.jpg`,
    description: 'No shrinkage guarantee, lanolin nourishment wash, and lint removal.',
  },

  // ── BULK LAUNDRY ──
  {
    id: 'bulk-1',
    name: 'Everyday Wash & Fold',
    category: 'Bulk Laundry',
    categorySlug: 'bulk-laundry',
    serviceType: 'Weighed per KG',
    tat: '24H',
    price: 49,
    unit: 'kg',
    imageUrl: `${S3_BASE}/services/service_wash_fold.jpg`,
    description: 'Everyday casuals, t-shirts, shorts & towels washed with premium detergent and neatly folded.',
  },
  {
    id: 'bulk-2',
    name: 'Wash & Steam Iron (KG)',
    category: 'Bulk Laundry',
    categorySlug: 'bulk-laundry',
    serviceType: 'Crisp Hanger Packaging',
    tat: '24H',
    price: 79,
    unit: 'kg',
    imageUrl: `${S3_BASE}/services/service_wash_iron.jpg`,
    description: 'Full cycle wash plus professional commercial steam pressing on rigid hangers.',
  },
  {
    id: 'bulk-3',
    name: 'Family Mixed Laundry',
    category: 'Bulk Laundry',
    categorySlug: 'bulk-laundry',
    serviceType: 'Ozone Sanitization Wash',
    tat: '24H',
    price: 59,
    unit: 'kg',
    imageUrl: `${S3_BASE}/banners/banner-bulk.jpg`,
    description: 'Medical-grade ozone sterilization killing 99.9% germs, bacteria, and stubborn odors.',
  },
  {
    id: 'bulk-4',
    name: 'Hostel & PG Saver Pack',
    category: 'Bulk Laundry',
    categorySlug: 'bulk-laundry',
    serviceType: 'Eco Detergent & Softener',
    tat: '24H',
    price: 45,
    unit: 'kg',
    imageUrl: `${S3_BASE}/banners/banner-bulk.jpg`,
    description: 'Eco-friendly detergent and fabric softener treatment for hostel everyday wear.',
  },

  // ── HOME LINEN ──
  {
    id: 'home-1',
    name: 'Double Bedsheet & Pillows',
    category: 'Home Linen',
    categorySlug: 'home-textiles',
    serviceType: 'Deep Clean & Iron',
    tat: '48H',
    price: 179,
    unit: 'set',
    imageUrl: `${S3_BASE}/garments/cloth-bedsheet-king.jpg`,
    description: '60°C thermal wash eliminating allergens and dust mites with crisp press.',
  },
  {
    id: 'home-2',
    name: 'Heavy Blanket / Quilt',
    category: 'Home Linen',
    categorySlug: 'home-textiles',
    serviceType: 'Thermal Sanitization Wash',
    tat: '48H',
    price: 299,
    unit: 'pc',
    imageUrl: `${S3_BASE}/garments/cloth-blanket-double.jpg`,
    description: 'Fiber plumping, micro-fiber dust extraction, and breathable zipped bag.',
  },
  {
    id: 'home-3',
    name: 'Window & Door Curtains',
    category: 'Home Linen',
    categorySlug: 'home-textiles',
    serviceType: 'Deep Dust Steam Wash',
    tat: '48H',
    price: 149,
    unit: 'panel',
    imageUrl: `${S3_BASE}/garments/cloth-curtain-long.jpg`,
    description: 'Heavy steam dust extraction without color fading or fabric shrinkage.',
  },
  {
    id: 'home-4',
    name: 'Bath Towels & Robes',
    category: 'Home Linen',
    categorySlug: 'home-textiles',
    serviceType: 'Softener Fluff & Dry',
    tat: '24H',
    price: 69,
    unit: 'pc',
    imageUrl: `${S3_BASE}/garments/cloth-towel-bath.jpg`,
    description: 'Softener-rich fluff cycle and quick-dry treatment for plush towels.',
  },
];

/** Lookup map for O(1) access by item id */
export const STATIC_CATALOG_MAP: Record<string, StaticCatalogItem> = Object.fromEntries(
  STATIC_CATALOG_ITEMS.map((item) => [item.id, item]),
);

export const STATIC_ITEMS_BY_CATEGORY: Record<string, StaticCatalogItem[]> = STATIC_CATALOG_ITEMS.reduce<Record<string, StaticCatalogItem[]>>(
  (acc, item) => {
    if (!acc[item.categorySlug]) {
      acc[item.categorySlug] = [];
    }
    acc[item.categorySlug]!.push(item);
    return acc;
  },
  {},
);
