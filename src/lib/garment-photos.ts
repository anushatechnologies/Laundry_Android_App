/**
 * Resolves original garment photo URL from AWS S3 cloud storage.
 * Prioritizes actual customUrl / imageUrl uploaded in database or S3.
 * 100% S3 Cloud Storage URLs for all products & categories.
 */

const S3_BASE_URL = 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com';
const S3_GARMENTS_BASE_URL = `${S3_BASE_URL}/garments`;

export function getGarmentImageUrl(clothId: string, customUrl?: string, categoryTag?: string): string {
  // 1. If custom / S3 cloud URL is explicitly provided from the API
  if (customUrl && typeof customUrl === 'string' && customUrl.trim().length > 10 && !customUrl.includes('placeholder')) {
    return customUrl.trim();
  }

  // 2. Exact match in S3 bucket
  const cleanId = (clothId || 'cloth-shirt').toLowerCase().trim();
  return `${S3_GARMENTS_BASE_URL}/${cleanId}.jpg`;
}
