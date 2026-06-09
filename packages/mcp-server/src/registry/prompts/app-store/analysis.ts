import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { countryInput } from '../../../schemas/index.js';

const appIdentifier = z.string().min(1).describe('Numeric App Store ID or bundle identifier');

function prompt (text: string) {
  return {
    messages: [{
      role: 'user' as const,
      content: { type: 'text' as const, text }
    }]
  };
}

const evidenceRules = `Evidence rules:
- Invoke the listed MCP tools to collect current App Store data; do not invent missing values.
- Label tool-sourced information as "Sourced facts".
- Put interpretations under "Analysis" and proposed actions under "Recommendations".
- State data gaps, country assumptions, and the time-sensitive nature of App Store results.`;

export function registerAppStoreAnalysisPrompts (server: McpServer): void {
  server.registerPrompt('app_store_analyze_market', {
    title: 'Analyze App Store Market',
    description: 'Analyze an App Store search market, chart category, and leading apps.',
    argsSchema: {
      term: z.string().min(1).describe('Market or search term to analyze'),
      country: countryInput,
      category: z.string().optional().describe('Optional category name or numeric category ID')
    }
  }, ({ term, country, category }) => prompt(`Analyze the App Store market for "${term}" in ${(country ?? 'us').toUpperCase()}.
${category !== undefined ? `Focus on category "${category}".` : 'Cover the most relevant categories.'}

Use:
- app_store_search_apps for the leading search competitors.
- app_store_list_apps for chart context. Read app-store://reference/categories and app-store://reference/collections when selecting chart inputs.
- app_store_get_app for full details on the strongest competitors.

Compare positioning, developers, genres, pricing, ratings, release cadence, and visible differentiation. Identify market patterns and underserved opportunities.

${evidenceRules}`));

  server.registerPrompt('app_store_compare_competitors', {
    title: 'Compare App Store Competitors',
    description: 'Compare two or more App Store apps using listing, rating, privacy, and version data.',
    argsSchema: {
      appIdentifiers: z.string().min(1).describe('Comma-separated numeric IDs or bundle identifiers'),
      country: countryInput
    }
  }, ({ appIdentifiers, country }) => prompt(`Compare these App Store competitors in ${(country ?? 'us').toUpperCase()}: ${appIdentifiers}.

Use for every app:
- app_store_get_app for complete listing and positioning data.
- app_store_get_ratings for rating distribution when a numeric ID is available.
- app_store_get_privacy for declared privacy practices when a numeric ID is available.
- app_store_get_version_history for release cadence when a numeric ID is available.
- app_store_get_similar_apps to identify adjacent competitors when useful.

Produce a comparison table followed by strengths, weaknesses, differentiation, risks, and actionable opportunities. Do not treat a missing numeric ID as evidence that ratings, privacy, or version history are absent.

${evidenceRules}`));

  server.registerPrompt('app_store_audit_listing', {
    title: 'Audit App Store Listing',
    description: 'Audit one App Store listing for clarity, positioning, trust, and conversion opportunities.',
    argsSchema: {
      appIdentifier,
      country: countryInput
    }
  }, ({ appIdentifier, country }) => prompt(`Audit the App Store listing for ${appIdentifier} in ${(country ?? 'us').toUpperCase()}.

Use:
- app_store_get_app for the complete listing, screenshots, pricing, and metadata.
- app_store_get_ratings, app_store_get_privacy, and app_store_get_version_history when a numeric ID is available.
- app_store_get_similar_apps for competitive context.

Assess title and subtitle clarity, description structure, category fit, screenshots, pricing, trust signals, privacy disclosures, ratings, and release activity. Prioritize recommendations by likely impact and effort. Do not claim visual screenshot details beyond metadata returned by tools.

${evidenceRules}`));

  server.registerPrompt('app_store_analyze_reviews_and_ratings', {
    title: 'Analyze App Store Reviews And Ratings',
    description: 'Analyze review themes and rating distribution for one App Store app.',
    argsSchema: {
      appIdentifier,
      country: countryInput
    }
  }, ({ appIdentifier, country }) => prompt(`Analyze reviews and ratings for ${appIdentifier} in ${(country ?? 'us').toUpperCase()}.

Use:
- app_store_get_reviews with both mostRecent and mostHelpful sorting. Read app-store://reference/sort for supported values.
- app_store_get_ratings when a numeric ID is available.
- app_store_get_app for product and version context.
- app_store_get_version_history when a numeric ID is available to relate feedback to releases.

Group recurring praise, complaints, feature requests, reliability issues, and support concerns. Quantify themes only from the collected sample, distinguish recent from persistent issues, and recommend prioritized product or listing actions.

${evidenceRules}`));
}
