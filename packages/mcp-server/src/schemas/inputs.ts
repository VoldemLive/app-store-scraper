import { z } from 'zod';
import { markets } from 'app-store-scraper';

const supportedCountries = new Set(Object.keys(markets));

export const countryInput = z.string().length(2)
  .refine(country => supportedCountries.has(country.toUpperCase()), 'Unsupported App Store country code')
  .transform(country => country.toLowerCase())
  .optional()
  .describe('Supported two-letter App Store country code (default: us; see app-store://reference/markets)');
