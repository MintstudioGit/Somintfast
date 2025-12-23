/**
 * Google Maps Places API Integration
 * Free tier: 28,000 requests/month (sufficient for testing)
 *
 * To use: Set GOOGLE_MAPS_API_KEY environment variable
 * Get free key: https://console.cloud.google.com/google/maps-apis
 */

export interface GoogleMapsResult {
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  placeId: string;
  types: string[];
  found: boolean;
}

export class GoogleMapsClient {
  private apiKey: string | undefined;
  private baseUrl = 'https://maps.googleapis.com/maps/api/place';

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
  }

  /**
   * Search for a business by name and location
   */
  async searchBusiness(
    businessName: string,
    location?: string
  ): Promise<GoogleMapsResult | null> {
    if (!this.apiKey) {
      console.warn('Google Maps API key not configured - using fallback');
      return null;
    }

    try {
      const query = location
        ? `${businessName} ${location}`
        : businessName;

      // Text Search API
      const searchUrl = `${this.baseUrl}/textsearch/json?query=${encodeURIComponent(query)}&key=${this.apiKey}`;

      const response = await fetch(searchUrl);
      const data = await response.json();

      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        return null;
      }

      const place = data.results[0];

      // Get detailed information
      const details = await this.getPlaceDetails(place.place_id);

      return {
        name: place.name,
        address: place.formatted_address,
        phone: details?.formatted_phone_number,
        website: details?.website,
        rating: place.rating,
        placeId: place.place_id,
        types: place.types || [],
        found: true,
      };
    } catch (error) {
      console.error('Google Maps search error:', error);
      return null;
    }
  }

  /**
   * Get detailed place information
   */
  private async getPlaceDetails(placeId: string): Promise<any> {
    if (!this.apiKey) return null;

    try {
      const detailsUrl = `${this.baseUrl}/details/json?place_id=${placeId}&fields=formatted_phone_number,website&key=${this.apiKey}`;

      const response = await fetch(detailsUrl);
      const data = await response.json();

      if (data.status === 'OK' && data.result) {
        return data.result;
      }

      return null;
    } catch (error) {
      console.error('Google Maps details error:', error);
      return null;
    }
  }

  /**
   * Find business by website URL (reverse lookup)
   */
  async findByWebsite(websiteUrl: string): Promise<GoogleMapsResult | null> {
    if (!this.apiKey) return null;

    try {
      // Extract domain from URL
      const domain = new URL(websiteUrl).hostname.replace('www.', '');

      // Search by domain
      const searchUrl = `${this.baseUrl}/textsearch/json?query=${encodeURIComponent(domain)}&key=${this.apiKey}`;

      const response = await fetch(searchUrl);
      const data = await response.json();

      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        return null;
      }

      // Find the result that matches the website
      for (const place of data.results) {
        const details = await this.getPlaceDetails(place.place_id);

        if (details?.website && details.website.includes(domain)) {
          return {
            name: place.name,
            address: place.formatted_address,
            phone: details.formatted_phone_number,
            website: details.website,
            rating: place.rating,
            placeId: place.place_id,
            types: place.types || [],
            found: true,
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Google Maps website lookup error:', error);
      return null;
    }
  }
}
