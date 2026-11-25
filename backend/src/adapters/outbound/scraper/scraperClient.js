import { AppError } from '../../../core/domain/errors.js';

export function createScraperClient({ scraperUrl }) {
  return {
    async scrapeStore(store) {
      const response = await fetch(`${scraperUrl}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: store.id,
          slug: store.slug,
          base_url: store.base_url,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new AppError(`Error en scraper (${response.status}): ${text}`, 502);
      }

      const data = await response.json();
      return data.products || [];
    },
  };
}
