/**
 * Resolves original high-definition garment photo URLs.
 * Maps garment identifiers and keywords to verified, authentic clothing images on AWS S3.
 */

const S3_GARMENTS = 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/garments';
export const FALLBACK_PHOTO = `${S3_GARMENTS}/cloth-shirt.jpg`;

const GARMENT_PHOTO_MAP: Record<string, string> = {
  // Shirts & Tops
  'cloth-shirt': `${S3_GARMENTS}/cloth-shirt.jpg`,
  'cloth-shirt-casual': `${S3_GARMENTS}/cloth-shirt.jpg`,
  'shirt': `${S3_GARMENTS}/cloth-shirt.jpg`,
  
  // T-Shirts & Polos
  'cloth-tshirt': `${S3_GARMENTS}/cloth-tshirt.jpg`,
  'cloth-polo': `${S3_GARMENTS}/cloth-tshirt.jpg`,
  'tshirt': `${S3_GARMENTS}/cloth-tshirt.jpg`,
  'polo': `${S3_GARMENTS}/cloth-tshirt.jpg`,
  
  // Trousers & Pants
  'cloth-trouser': `${S3_GARMENTS}/cloth-trouser.jpg`,
  'cloth-pants': `${S3_GARMENTS}/cloth-trouser.jpg`,
  'trouser': `${S3_GARMENTS}/cloth-trouser.jpg`,
  'pant': `${S3_GARMENTS}/cloth-trouser.jpg`,
  'chinos': `${S3_GARMENTS}/cloth-trouser.jpg`,
  
  // Jeans & Denim
  'cloth-jeans': `${S3_GARMENTS}/cloth-jeans.jpg`,
  'cloth-w-jeans': `${S3_GARMENTS}/cloth-jeans.jpg`,
  'jeans': `${S3_GARMENTS}/cloth-jeans.jpg`,
  'denim': `${S3_GARMENTS}/cloth-jeans.jpg`,
  
  // Suits & Blazers
  'cloth-suit-2p': `${S3_GARMENTS}/cloth-suit-2p.jpg`,
  'cloth-suit-3p': `${S3_GARMENTS}/cloth-suit-3p.jpg`,
  'cloth-blazer': `${S3_GARMENTS}/cloth-blazer.jpg`,
  'suit': `${S3_GARMENTS}/cloth-suit-2p.jpg`,
  'blazer': `${S3_GARMENTS}/cloth-blazer.jpg`,
  'coat': `${S3_GARMENTS}/cloth-blazer.jpg`,
  
  // Shorts & Bermudas
  'cloth-shorts': `${S3_GARMENTS}/cloth-shorts-m.jpg`,
  'cloth-shorts-m': `${S3_GARMENTS}/cloth-shorts-m.jpg`,
  'shorts': `${S3_GARMENTS}/cloth-shorts-m.jpg`,
  'bermuda': `${S3_GARMENTS}/cloth-shorts-m.jpg`,
  'cloth-kids-shorts': `${S3_GARMENTS}/cloth-kids-shorts.jpg`,
  'cloth-1788337003869': `${S3_GARMENTS}/cloth-kids-shorts.jpg`,
  'cloth-kid-pant': `${S3_GARMENTS}/cloth-kids-shorts.jpg`,

  // Winter Wear / Sweaters / Jackets
  'cloth-sweater': `${S3_GARMENTS}/cloth-sweater-m.jpg`,
  'cloth-pullover': `${S3_GARMENTS}/cloth-sweater-m.jpg`,
  'cloth-jacket': `${S3_GARMENTS}/cloth-jacket.jpg`,
  'cloth-w-jacket': `${S3_GARMENTS}/cloth-jacket.jpg`,
  'sweater': `${S3_GARMENTS}/cloth-sweater-m.jpg`,
  'jacket': `${S3_GARMENTS}/cloth-jacket.jpg`,
  
  // Ethnic & Royal Occasion Wear
  'cloth-kurta-m': `${S3_GARMENTS}/cloth-kurta-m.jpg`,
  'kurta': `${S3_GARMENTS}/cloth-kurta-m.jpg`,
  'cloth-sherwani': `${S3_GARMENTS}/cloth-sherwani.jpg`,
  'sherwani': `${S3_GARMENTS}/cloth-sherwani.jpg`,
  'indo-western': `${S3_GARMENTS}/cloth-sherwani.jpg`,
  'cloth-indo-western': `${S3_GARMENTS}/cloth-sherwani.jpg`,
  'cloth-nehru': `${S3_GARMENTS}/cloth-nehru.jpg`,
  'cloth-dhoti': `${S3_GARMENTS}/cloth-dhoti.jpg`,
  'dhoti': `${S3_GARMENTS}/cloth-dhoti.jpg`,
  'lungi': `${S3_GARMENTS}/cloth-dhoti.jpg`,
  'mundu': `${S3_GARMENTS}/cloth-dhoti.jpg`,
  'cloth-kids-ethnic': `${S3_GARMENTS}/cloth-kids-ethnic.jpg`,
  'cloth-tracksuit': `${S3_GARMENTS}/cloth-tracksuit-m.jpg`,
  
  // Sarees & Blouses
  'cloth-saree-cotton': `${S3_GARMENTS}/cloth-saree-cotton.jpg`,
  'cloth-saree-silk': `${S3_GARMENTS}/cloth-saree-silk.jpg`,
  'cloth-saree': `${S3_GARMENTS}/cloth-saree-cotton.jpg`,
  'cloth-saree-heavy': `${S3_GARMENTS}/cloth-saree-cotton.jpg`,
  'cloth-saree-reg': `${S3_GARMENTS}/cloth-saree-cotton.jpg`,
  'cloth-1788337003358': `${S3_GARMENTS}/cloth-saree-cotton.jpg`,
  'saree': `${S3_GARMENTS}/cloth-saree-cotton.jpg`,
  'designer-saree': `${S3_GARMENTS}/cloth-saree-cotton.jpg`,
  'cloth-blouse': `${S3_GARMENTS}/cloth-blouse.jpg`,
  'cloth-blouse-padded': `${S3_GARMENTS}/cloth-blouse-designer.jpg`,
  'blouse': `${S3_GARMENTS}/cloth-blouse.jpg`,
  'cloth-dupatta': `${S3_GARMENTS}/cloth-dupatta.jpg`,
  'cloth-sharara': `${S3_GARMENTS}/cloth-sharara.jpg`,
  'cloth-shawl': `${S3_GARMENTS}/cloth-shawl.jpg`,
  
  // Women's Western / Dresses / Gowns / Kurtis
  'cloth-w-top': `${S3_GARMENTS}/cloth-kurti.jpg`,
  'cloth-gown': `${S3_GARMENTS}/cloth-gown.jpg`,
  'cloth-dress': `${S3_GARMENTS}/cloth-gown.jpg`,
  'cloth-dress-w': `${S3_GARMENTS}/cloth-gown.jpg`,
  'cloth-lehenga': `${S3_GARMENTS}/cloth-lehenga.jpg`,
  'lehenga': `${S3_GARMENTS}/cloth-lehenga.jpg`,
  'kurti': `${S3_GARMENTS}/cloth-kurti.jpg`,
  'cloth-kurti': `${S3_GARMENTS}/cloth-kurti.jpg`,
  'gown': `${S3_GARMENTS}/cloth-gown.jpg`,
  'dress': `${S3_GARMENTS}/cloth-gown.jpg`,
  'cloth-salwar': `${S3_GARMENTS}/cloth-salwar.jpg`,
  'salwar': `${S3_GARMENTS}/cloth-salwar.jpg`,
  'cloth-leggings': `${S3_GARMENTS}/cloth-leggings-plazo.jpg`,
  'cloth-nighty': `${S3_GARMENTS}/cloth-nighty-loungewear.jpg`,

  // Home Textiles & Linens
  'cloth-bedsheet-s': `${S3_GARMENTS}/cloth-bedsheet-single.jpg`,
  'cloth-bedsheet-d': `${S3_GARMENTS}/cloth-bedsheet-king.jpg`,
  'cloth-blanket': `${S3_GARMENTS}/cloth-blanket-single.jpg`,
  'cloth-blanket-s': `${S3_GARMENTS}/cloth-blanket-single.jpg`,
  'cloth-blanket-d': `${S3_GARMENTS}/cloth-blanket-double.jpg`,
  'cloth-comforter': `${S3_GARMENTS}/cloth-quilt-double.jpg`,
  'cloth-curtain': `${S3_GARMENTS}/cloth-curtain-door.jpg`,
  'bedsheet': `${S3_GARMENTS}/cloth-bedsheet-single.jpg`,
  'blanket': `${S3_GARMENTS}/cloth-blanket-single.jpg`,
  'curtain': `${S3_GARMENTS}/cloth-curtain-door.jpg`,
  'towel': `${S3_GARMENTS}/cloth-bath-towel-large.jpg`,
  'cloth-towel': `${S3_GARMENTS}/cloth-bath-towel-large.jpg`,
  'cloth-1788337004377': `${S3_GARMENTS}/cloth-bath-towel-turkish.jpg`,
  'cloth-1788337004390': `${S3_GARMENTS}/cloth-hand-towel.jpg`,
  'cloth-1788337004402': `${S3_GARMENTS}/cloth-bathrobe.jpg`,
  'cloth-pillow-cover': `${S3_GARMENTS}/cloth-pillow.jpg`,
  'cloth-sofa-cover': `${S3_GARMENTS}/cloth-sofa-cover-3s.jpg`,
  'cloth-doormat': `${S3_GARMENTS}/cloth-doormat-heavy.jpg`,
  'cloth-tablecloth': `${S3_GARMENTS}/cloth-table-runner.jpg`,
  
  // Bags, Shoes & Accessories
  'cloth-bag-backpack': `${S3_GARMENTS}/cloth-bag-backpack.jpg`,
  'cloth-bag-luxury': `${S3_GARMENTS}/cloth-bag-luxury.jpg`,
  'cloth-trolley-cabin': `${S3_GARMENTS}/cloth-trolley-cabin.jpg`,
  'cloth-trolley-large': `${S3_GARMENTS}/cloth-trolley-large.jpg`,
  'cloth-shoes-formal': `${S3_GARMENTS}/cloth-shoes-formal.jpg`,
  'cloth-shoes-sneaker': 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_shoe_clean.jpg',
  'cloth-shoes-suede': `${S3_GARMENTS}/cloth-shoes-suede.jpg`,
  'cloth-helmet': `${S3_GARMENTS}/cloth-helmet.jpg`,
  'cloth-tie': `${S3_GARMENTS}/cloth-ties-pocket-square.jpg`,
  'cloth-soft-toy': `${S3_GARMENTS}/cloth-soft-toys.jpg`,
  'cloth-baby-romper': `${S3_GARMENTS}/cloth-baby-set.jpg`,
  'cloth-kid-shirt': `${S3_GARMENTS}/cloth-kid-shirt.jpg`,
  'cloth-kid-dress': `${S3_GARMENTS}/cloth-kids-frock.jpg`,
  'cloth-kid-uniform': `${S3_GARMENTS}/cloth-kid-uniform-pant.jpg`,

  // Bulk Laundry Categories
  'bulk': 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/cat-wash-fold.jpg',
  'bulk-laundry': 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/cat-wash-fold.jpg',
  'bulk-1': 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/cat-wash-fold.jpg',
  'bulk-2': 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/cat-wash-iron.jpg',
  'bulk-3': 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/cat-premium-wash.jpg',
  'bulk-4': 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/cat-steam-iron.jpg',
};

export function getGarmentImageUrl(clothId: string, customUrl?: string, categoryTag?: string, clothName?: string): string {
  // 1. If explicit working URL (not 404 S3 bucket or invalid svg)
  if (customUrl && typeof customUrl === 'string' && customUrl.trim().startsWith('http')) {
    if (
      !customUrl.includes('1788334884393') &&
      !customUrl.includes('1788337350676') &&
      !customUrl.includes('.svg') &&
      !customUrl.includes('accessories.jpg')
    ) {
      return customUrl.trim();
    }
  }

  const cleanId = String(clothId || '').toLowerCase().trim();
  const cleanName = String(clothName || '').toLowerCase().trim();
  const cleanCategory = String(categoryTag || '').toUpperCase().trim();

  // 2. Extract base cloth ID if composite ID (e.g. `cloth-shorts-m-srv-m-steam-iron` -> `cloth-shorts-m`)
  const baseClothId = (cleanId.includes('-srv-') ? cleanId.split('-srv-')[0] : cleanId) || '';

  // 3. Direct ID match
  if (baseClothId && GARMENT_PHOTO_MAP[baseClothId]) {
    return GARMENT_PHOTO_MAP[baseClothId];
  }
  if (cleanId && GARMENT_PHOTO_MAP[cleanId]) {
    return GARMENT_PHOTO_MAP[cleanId];
  }

  // 4. Match by keywords
  const searchStr = `${cleanId} ${cleanName}`;

  if (cleanId.startsWith('bulk') || searchStr.includes('bulk') || searchStr.includes('kg') || cleanCategory.includes('BULK')) {
    return GARMENT_PHOTO_MAP['bulk'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('helmet')) {
    return GARMENT_PHOTO_MAP['cloth-helmet'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('shawl') || searchStr.includes('pashmina')) {
    return GARMENT_PHOTO_MAP['cloth-shawl'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('handbag') || searchStr.includes('purse')) {
    return GARMENT_PHOTO_MAP['cloth-bag-luxury'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('trolley') || searchStr.includes('suitcase') || searchStr.includes('luggage')) {
    return (searchStr.includes('large') || searchStr.includes('28'))
      ? (GARMENT_PHOTO_MAP['cloth-trolley-large'] || FALLBACK_PHOTO)
      : (GARMENT_PHOTO_MAP['cloth-trolley-cabin'] || FALLBACK_PHOTO);
  }
  if (searchStr.includes('short') || searchStr.includes('bermuda')) {
    if (searchStr.includes('kid') || searchStr.includes('child')) {
      return GARMENT_PHOTO_MAP['cloth-kids-shorts'] || FALLBACK_PHOTO;
    }
    return GARMENT_PHOTO_MAP['cloth-shorts-m'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('t-shirt') || searchStr.includes('tshirt') || searchStr.includes('polo')) {
    return GARMENT_PHOTO_MAP['cloth-tshirt'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('shirt')) {
    return GARMENT_PHOTO_MAP['cloth-shirt'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('suit') || searchStr.includes('blazer') || searchStr.includes('coat')) {
    return GARMENT_PHOTO_MAP['cloth-suit-2p'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('trouser') || searchStr.includes('pant') || searchStr.includes('chino')) {
    return GARMENT_PHOTO_MAP['cloth-trouser'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('jean') || searchStr.includes('denim')) {
    return GARMENT_PHOTO_MAP['cloth-jeans'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('sweater') || searchStr.includes('pullover')) {
    return GARMENT_PHOTO_MAP['cloth-sweater'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('jacket')) {
    return GARMENT_PHOTO_MAP['cloth-jacket'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('sherwani') || searchStr.includes('indo-western') || searchStr.includes('indowestern')) {
    return GARMENT_PHOTO_MAP['cloth-sherwani'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('dhoti') || searchStr.includes('lungi') || searchStr.includes('mundu')) {
    return (searchStr.includes('kid') || searchStr.includes('child'))
      ? (GARMENT_PHOTO_MAP['cloth-kids-ethnic'] || GARMENT_PHOTO_MAP['cloth-dhoti'] || FALLBACK_PHOTO)
      : (GARMENT_PHOTO_MAP['cloth-dhoti'] || FALLBACK_PHOTO);
  }
  if (searchStr.includes('kurta')) {
    if (searchStr.includes('kid') || searchStr.includes('child')) {
      return GARMENT_PHOTO_MAP['cloth-kids-ethnic'] || GARMENT_PHOTO_MAP['cloth-kurta-m'] || FALLBACK_PHOTO;
    }
    return GARMENT_PHOTO_MAP['cloth-kurta-m'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('kurti') || searchStr.includes('tunic')) {
    return GARMENT_PHOTO_MAP['cloth-kurti'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('lehenga')) {
    return GARMENT_PHOTO_MAP['cloth-lehenga'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('saree')) {
    return (searchStr.includes('silk') || searchStr.includes('kanchipuram') || searchStr.includes('zari'))
      ? (GARMENT_PHOTO_MAP['cloth-saree-silk'] || FALLBACK_PHOTO)
      : (GARMENT_PHOTO_MAP['cloth-saree-cotton'] || FALLBACK_PHOTO);
  }
  if (searchStr.includes('blouse')) {
    return GARMENT_PHOTO_MAP['cloth-blouse'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('dress') || searchStr.includes('gown')) {
    return GARMENT_PHOTO_MAP['cloth-gown'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('salwar')) {
    return GARMENT_PHOTO_MAP['cloth-salwar'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('bedsheet') || searchStr.includes('linen')) {
    return (searchStr.includes('king') || searchStr.includes('double'))
      ? (GARMENT_PHOTO_MAP['cloth-bedsheet-d'] || FALLBACK_PHOTO)
      : (GARMENT_PHOTO_MAP['cloth-bedsheet-s'] || FALLBACK_PHOTO);
  }
  if (searchStr.includes('blanket') || searchStr.includes('quilt') || searchStr.includes('comforter')) {
    return searchStr.includes('double')
      ? (GARMENT_PHOTO_MAP['cloth-blanket-d'] || FALLBACK_PHOTO)
      : (GARMENT_PHOTO_MAP['cloth-blanket-s'] || FALLBACK_PHOTO);
  }
  if (searchStr.includes('curtain')) {
    return GARMENT_PHOTO_MAP['cloth-curtain'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('towel') || searchStr.includes('bathrobe')) {
    return GARMENT_PHOTO_MAP['cloth-towel'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('backpack') || searchStr.includes('school bag') || searchStr.includes('bag')) {
    return GARMENT_PHOTO_MAP['cloth-bag-backpack'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('shoe') || searchStr.includes('sneaker') || searchStr.includes('footwear')) {
    return searchStr.includes('formal')
      ? (GARMENT_PHOTO_MAP['cloth-shoes-formal'] || FALLBACK_PHOTO)
      : (GARMENT_PHOTO_MAP['cloth-shoes-sneaker'] || FALLBACK_PHOTO);
  }
  if (searchStr.includes('baby') || searchStr.includes('romper')) {
    return GARMENT_PHOTO_MAP['cloth-baby-romper'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('uniform')) {
    return GARMENT_PHOTO_MAP['cloth-kid-uniform'] || FALLBACK_PHOTO;
  }

  // Fallback by category
  const cat = cleanCategory;
  if (cat.includes('WOMEN')) return GARMENT_PHOTO_MAP['cloth-saree-cotton'] || FALLBACK_PHOTO;
  if (cat.includes('HOME')) return GARMENT_PHOTO_MAP['cloth-bedsheet-s'] || FALLBACK_PHOTO;
  if (cat.includes('KID')) return GARMENT_PHOTO_MAP['cloth-kids-shorts'] || FALLBACK_PHOTO;
  return GARMENT_PHOTO_MAP['cloth-shirt'] || FALLBACK_PHOTO;
}
