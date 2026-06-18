import { createContext, useContext } from 'react'

const defaultBrand = {
  primaryColor:   '#1B4F72',
  secondaryColor: '#D4AF37',
  logoUrl:        '/partna-icon.svg',
  businessName:   'Partna',
  portalUrl:      '',
  slug:           '',
  sector:         'Education',
}

export const BrandContext = createContext(defaultBrand)

export function useBrand() {
  return useContext(BrandContext)
}

export function buildBrand(business) {
  if (!business) return defaultBrand
  return {
    primaryColor:   business.primary_color   || defaultBrand.primaryColor,
    secondaryColor: business.secondary_color || defaultBrand.secondaryColor,
    logoUrl:        business.logo_url        || defaultBrand.logoUrl,
    businessName:   business.name           || defaultBrand.businessName,
    portalUrl:      business.portal_url      || defaultBrand.portalUrl,
    slug:           business.slug            || defaultBrand.slug,
    sector:         business.sector          || 'Education',
  }
}