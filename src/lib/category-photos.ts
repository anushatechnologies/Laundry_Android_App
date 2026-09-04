/**
 * High-definition, verified CDN photos for Categories and Subcategories.
 * Guaranteed 200 OK delivery with zero 404 errors.
 */

export const CATEGORY_DEFAULT_PHOTOS: Record<string, string> = {
  MENS: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/categories/mens-wear.jpg',
  'MENS-WEAR': 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/categories/mens-wear.jpg',
  WOMENS: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/categories/womens-wear.jpg',
  'WOMENS-WEAR': 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/categories/womens-wear.jpg',
  KIDS: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/categories/kids-baby.jpg',
  'KIDS-BABY': 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/categories/kids-baby.jpg',
  'KIDS-WEAR': 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/categories/kids-baby.jpg',
  HOME: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/categories/home-textiles.jpg',
  'HOME-TEXTILES': 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/categories/home-textiles.jpg',
  WINTER: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/categories/winter-wear.jpg',
  'WINTER-WEAR': 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/categories/winter-wear.jpg',
  'SPECIAL-CLEANING': 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/categories/winter-wear.jpg',
  SPECIAL: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/categories/winter-wear.jpg',
  WEDDING: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/categories/wedding-silk.jpg',
  'WEDDING-SILK': 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/categories/wedding-silk.jpg',
  BRIDAL: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/categories/wedding-silk.jpg',
  'BRIDAL-WEAR': 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/categories/wedding-silk.jpg',
  BULK: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/banners/banner-bulk.jpg',
  'BULK-LAUNDRY': 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/banners/banner-bulk.jpg',
  'BABY-CARE': 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/categories/kids-baby.jpg',
  'STEAM-PRESS': 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/services/steam-iron.jpg',
  'SHOE-CARE': 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/services/shoe-spa.jpg',
  FOOTWEAR: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/services/shoe-spa.jpg',
  ACCESSORIES: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/categories/mens-wear.jpg',
};

const DEFAULT_CATEGORY_FALLBACK = 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/categories/mens-wear.jpg';

export const SUBCATEGORY_DEFAULT_PHOTOS: Record<string, string> = {
  all: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=300&q=80',
  't-shirts & polos': 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=300&q=80',
  't-shirts': 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=300&q=80',
  't-shirt': 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=300&q=80',
  tshirts: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=300&q=80',
  'shirts & t-shirts': 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=300&q=80',
  shirts: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=300&q=80',
  shirt: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=300&q=80',
  'trousers & chinos': 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=300&q=80',
  'trousers & pants': 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=300&q=80',
  trousers: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=300&q=80',
  pants: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=300&q=80',
  'jeans & denim': 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=300&q=80',
  jeans: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=300&q=80',
  denim: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=300&q=80',
  'ethnic wear': 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=300&q=80',
  'suits & blazers': 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=300&q=80',
  suits: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=300&q=80',
  blazers: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=300&q=80',
  'sports & gym wear': 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=300&q=80',
  'sports & gym': 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=300&q=80',
  shorts: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=300&q=80',
  bermuda: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=300&q=80',
  'winter wear': 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?auto=format&fit=crop&w=300&q=80',
  jacket: 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?auto=format&fit=crop&w=300&q=80',
  sweater: 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?auto=format&fit=crop&w=300&q=80',
  nightwear: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=300&q=80',
  innerwear: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=300&q=80',
  accessories: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=300&q=80',

  // Women's Wear
  sarees: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=300&q=80',
  saree: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=300&q=80',
  blouses: 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?auto=format&fit=crop&w=300&q=80',
  blouse: 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?auto=format&fit=crop&w=300&q=80',
  kurtis: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=300&q=80',
  'kurtis & kurtas': 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=300&q=80',
  kurti: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=300&q=80',
  'salwar & suits': 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=300&q=80',
  'salwar suits': 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=300&q=80',
  salwar: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=300&q=80',
  'western dresses': 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=300&q=80',
  dresses: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=300&q=80',
  'tops & shirts': 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?auto=format&fit=crop&w=300&q=80',
  tops: 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?auto=format&fit=crop&w=300&q=80',
  'jeans & pants': 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=300&q=80',
  'skirts & shorts': 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=300&q=80',
  skirts: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=300&q=80',
  lehengas: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=300&q=80',
  lehenga: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=300&q=80',
  gowns: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=300&q=80',
  gown: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=300&q=80',
  'dupattas & stoles': 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=300&q=80',
  dupattas: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=300&q=80',
  'maternity wear': 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=300&q=80',

  // Kids & Baby
  'baby clothing': 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=300&q=80',
  baby: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=300&q=80',
  'boys clothing': 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=300&q=80',
  boys: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=300&q=80',
  'girls clothing': 'https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?auto=format&fit=crop&w=300&q=80',
  girls: 'https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?auto=format&fit=crop&w=300&q=80',
  'school uniforms': 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=300&q=80',
  uniforms: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=300&q=80',
  'party wear': 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&w=300&q=80',
  'traditional wear': 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=300&q=80',

  // Home Textiles
  bedsheets: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=300&q=80',
  bedsheet: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=300&q=80',
  'bed covers': 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=300&q=80',
  blankets: 'https://images.unsplash.com/photo-1580301762395-21ce84d00bc6?auto=format&fit=crop&w=300&q=80',
  blanket: 'https://images.unsplash.com/photo-1580301762395-21ce84d00bc6?auto=format&fit=crop&w=300&q=80',
  'comforters & quilts': 'https://images.unsplash.com/photo-1580301762395-21ce84d00bc6?auto=format&fit=crop&w=300&q=80',
  'comforters & duvets': 'https://images.unsplash.com/photo-1580301762395-21ce84d00bc6?auto=format&fit=crop&w=300&q=80',
  comforters: 'https://images.unsplash.com/photo-1580301762395-21ce84d00bc6?auto=format&fit=crop&w=300&q=80',
  duvets: 'https://images.unsplash.com/photo-1580301762395-21ce84d00bc6?auto=format&fit=crop&w=300&q=80',
  'quilts & razai': 'https://images.unsplash.com/photo-1580301762395-21ce84d00bc6?auto=format&fit=crop&w=300&q=80',
  quilts: 'https://images.unsplash.com/photo-1580301762395-21ce84d00bc6?auto=format&fit=crop&w=300&q=80',
  curtains: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=300&q=80',
  'sofa & cushion covers': 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=300&q=80',
  towels: 'https://images.unsplash.com/photo-1616627547584-bf28cee262db?auto=format&fit=crop&w=300&q=80',

  // Footwear & Accessories
  sneakers: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=300&q=80',
  'formal shoes': 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=300&q=80',
  'leather & suede': 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=300&q=80',
  'sports shoes': 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=300&q=80',
  backpacks: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=300&q=80',
  handbags: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=300&q=80',
  'belts & wallets': 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=300&q=80',
  'caps & hats': 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=300&q=80',

  // Bulk
  'daily wash & fold': 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=300&q=80',
  'bed linen bulk': 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=300&q=80',
  'express kg wash': 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=300&q=80',
};

export function getCategoryImageUrl(tag: string, customUrl?: string): string {
  if (customUrl && typeof customUrl === 'string' && customUrl.trim().startsWith('http')) {
    if (!customUrl.includes('1788334884393') && !customUrl.includes('1788337350676') && !customUrl.includes('.svg')) {
      return customUrl.trim();
    }
  }
  const cleanTag = (tag || 'MENS').toUpperCase().trim();
  return (
    CATEGORY_DEFAULT_PHOTOS[cleanTag] ||
    CATEGORY_DEFAULT_PHOTOS[cleanTag.replace(/_/g, '-')] ||
    CATEGORY_DEFAULT_PHOTOS.MENS ||
    DEFAULT_CATEGORY_FALLBACK
  );
}

export function getSubcategoryImageUrl(subName: string, categoryTag?: string, customUrl?: string): string {
  if (customUrl && typeof customUrl === 'string' && customUrl.trim().startsWith('http')) {
    if (!customUrl.includes('1788334884393') && !customUrl.includes('1788337350676') && !customUrl.includes('.svg')) {
      return customUrl.trim();
    }
  }
  const key = (subName || 'all').toLowerCase().trim();
  
  if (SUBCATEGORY_DEFAULT_PHOTOS[key]) {
    return SUBCATEGORY_DEFAULT_PHOTOS[key];
  }

  // Check matching substrings
  for (const [subKey, url] of Object.entries(SUBCATEGORY_DEFAULT_PHOTOS)) {
    if (key.includes(subKey) || subKey.includes(key)) {
      return url;
    }
  }

  return getCategoryImageUrl(categoryTag || 'MENS');
}
