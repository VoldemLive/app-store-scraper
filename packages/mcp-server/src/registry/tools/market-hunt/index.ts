import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolExecutor } from '../../../application/index.js';
import { MarketHuntVectorCompiler } from '../../../market-hunt/index.js';

const LOCAL_READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

export function registerMarketHuntTools (
  server: McpServer,
  executeTool: ToolExecutor,
  compiler: MarketHuntVectorCompiler = new MarketHuntVectorCompiler()
): void {
  server.tool(
    'market_hunt_vector_compiler',
    'Generate a raw random seed lineage for agent-led application market research.',
    {
      strategy: z.literal('full_random')
        .describe('Random selection strategy. Version 1 supports only full_random.'),
      random_seed: z.string().min(1).max(256).optional()
        .describe('Optional deterministic seed for reproducible lineage generation.')
    },
    LOCAL_READ_ONLY,
    async ({ strategy, random_seed }, extra) =>
      executeTool('market_hunt_vector_compiler', extra, { provider: 'market-hunt' }, async () => {
        const result = await compiler.compileVector({
          strategy,
          ...(random_seed !== undefined && { random_seed })
        });
        return {
          text: 'Generated a raw market hunt seed lineage.',
          data: result
        };
      })
  );
}
