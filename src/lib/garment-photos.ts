/**
 * Resolves original high-definition garment photo URLs.
 * Maps garment identifiers and keywords to verified, authentic clothing images.
 */

const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=400&q=80';

const GARMENT_PHOTO_MAP: Record<string, string> = {
  // Shirts
  'cloth-shirt': 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=400&q=80',
  'cloth-shirt-casual': 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=400&q=80',
  'shirt': 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=400&q=80',
  
  // T-Shirts
  'cloth-tshirt': 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=400&q=80',
  'cloth-polo': 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=400&q=80',
  'tshirt': 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=400&q=80',
  
  // Trousers & Pants
  'cloth-trouser': 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=400&q=80',
  'cloth-pants': 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=400&q=80',
  'trouser': 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=400&q=80',
  
  // Jeans & Denim
  'cloth-jeans': 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=400&q=80',
  'cloth-w-jeans': 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=400&q=80',
  'jeans': 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=400&q=80',
  'denim': 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=400&q=80',
  
  // Suits & Blazers
  'cloth-suit-2p': 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=400&q=80',
  'cloth-suit-3p': 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=400&q=80',
  'cloth-blazer': 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=400&q=80',
  'suit': 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=400&q=80',
  'blazer': 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=400&q=80',
  
  // Shorts / Bermuda
  'cloth-shorts': 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=400&q=80',
  'cloth-shorts-m': 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=400&q=80',
  'shorts': 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=400&q=80',
  'bermuda': 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=400&q=80',

  // Winter Wear / Sweaters / Jackets
  'cloth-sweater': 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?auto=format&fit=crop&w=400&q=80',
  'cloth-pullover': 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?auto=format&fit=crop&w=400&q=80',
  'cloth-jacket': 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?auto=format&fit=crop&w=400&q=80',
  'cloth-w-jacket': 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?auto=format&fit=crop&w=400&q=80',
  'sweater': 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?auto=format&fit=crop&w=400&q=80',
  'jacket': 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?auto=format&fit=crop&w=400&q=80',
  
  // Ethnic
  'cloth-kurta-m': 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=400&q=80',
  'kurta': 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=400&q=80',
  
  // Sarees
  'cloth-saree-cotton': 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=400&q=80',
  'cloth-saree-silk': 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=400&q=80',
  'cloth-saree': 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=400&q=80',
  'saree': 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=400&q=80',
  
  // Women's Western / Dresses / Gowns
  'cloth-w-top': 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?auto=format&fit=crop&w=400&q=80',
  'cloth-gown': 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=400&q=80',
  'cloth-dress': 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=400&q=80',
  'cloth-lehenga': 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=400&q=80',
  'kurti': 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=400&q=80',
  'gown': 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=400&q=80',
  'dress': 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=400&q=80',

  // Home Textiles
  'cloth-bedsheet-s': 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=400&q=80',
  'cloth-bedsheet-d': 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=400&q=80',
  'cloth-blanket-s': 'https://images.unsplash.com/photo-1580301762395-21ce84d00bc6?auto=format&fit=crop&w=400&q=80',
  'cloth-blanket-d': 'https://images.unsplash.com/photo-1580301762395-21ce84d00bc6?auto=format&fit=crop&w=400&q=80',
  'cloth-curtain': 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80',
  'bedsheet': 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=400&q=80',
  'blanket': 'https://images.unsplash.com/photo-1580301762395-21ce84d00bc6?auto=format&fit=crop&w=400&q=80',
  'curtain': 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80',
  'towel': 'https://images.unsplash.com/photo-1616627547584-bf28cee262db?auto=format&fit=crop&w=400&q=80',
};

export function getGarmentImageUrl(clothId: string, customUrl?: string, categoryTag?: string, clothName?: string): string {
  // 1. If explicit working URL (not 404 S3 bucket)
  if (customUrl && typeof customUrl === 'string' && customUrl.trim().length > 10 && !customUrl.includes('laundry-storage-2026')) {
    return customUrl.trim();
  }

  const cleanId = (clothId || '').toLowerCase().trim();
  const cleanName = (clothName || '').toLowerCase().trim();

  // 2. Direct ID match
  if (GARMENT_PHOTO_MAP[cleanId]) {
    return GARMENT_PHOTO_MAP[cleanId];
  }

  // 3. Match by name keywords
  const searchStr = `${cleanId} ${cleanName}`;

  if (searchStr.includes('t-shirt') || searchStr.includes('tshirt') || searchStr.includes('polo')) {
    return GARMENT_PHOTO_MAP['tshirt'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('shirt')) {
    return GARMENT_PHOTO_MAP['shirt'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('suit') || searchStr.includes('blazer')) {
    return GARMENT_PHOTO_MAP['suit'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('trouser') || searchStr.includes('pant') || searchStr.includes('chino')) {
    return GARMENT_PHOTO_MAP['trouser'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('jean') || searchStr.includes('denim')) {
    return GARMENT_PHOTO_MAP['jeans'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('short') || searchStr.includes('bermuda')) {
    return GARMENT_PHOTO_MAP['shorts'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('sweater') || searchStr.includes('pullover') || searchStr.includes('jacket') || searchStr.includes('coat')) {
    return GARMENT_PHOTO_MAP['sweater'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('saree')) {
    return searchStr.includes('silk') 
      ? (GARMENT_PHOTO_MAP['cloth-saree-silk'] || FALLBACK_PHOTO) 
      : (GARMENT_PHOTO_MAP['cloth-saree-cotton'] || FALLBACK_PHOTO);
  }
  if (searchStr.includes('kurti') || searchStr.includes('kurta')) {
    return GARMENT_PHOTO_MAP['kurti'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('dress') || searchStr.includes('gown') || searchStr.includes('lehenga')) {
    return GARMENT_PHOTO_MAP['dress'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('bedsheet') || searchStr.includes('linen')) {
    return GARMENT_PHOTO_MAP['bedsheet'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('blanket') || searchStr.includes('quilt') || searchStr.includes('comforter')) {
    return GARMENT_PHOTO_MAP['blanket'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('curtain')) {
    return GARMENT_PHOTO_MAP['curtain'] || FALLBACK_PHOTO;
  }
  if (searchStr.includes('towel')) {
    return GARMENT_PHOTO_MAP['towel'] || FALLBACK_PHOTO;
  }

  // Fallback by category
  const cat = (categoryTag || '').toUpperCase();
  if (cat.includes('WOMEN')) return GARMENT_PHOTO_MAP['cloth-saree-cotton'] || FALLBACK_PHOTO;
  if (cat.includes('HOME')) return GARMENT_PHOTO_MAP['bedsheet'] || FALLBACK_PHOTO;
  if (cat.includes('KID')) return 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=400&q=80';
  return GARMENT_PHOTO_MAP['shirt'] || FALLBACK_PHOTO;
}
