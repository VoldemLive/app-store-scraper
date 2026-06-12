import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolExecutor } from '../../../application/index.js';
import { SearchVectorCompiler } from '../../../search-vector/index.js';

const LOCAL_READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

export function registerSearchVectorTools (
  server: McpServer,
  executeTool: ToolExecutor,
  compiler: SearchVectorCompiler = new SearchVectorCompiler()
): void {
  server.tool(
    'search_vector_compiler',
    'Generate a raw random seed lineage for agent-led application market research.',
    {
      strategy: z.literal('full_random')
        .describe('Random selection strategy. Version 1 supports only full_random.'),
      random_seed: z.string().min(1).max(256).optional()
        .describe('Optional deterministic seed for reproducible lineage generation.')
    },
    LOCAL_READ_ONLY,
    async ({ strategy, random_seed }, extra) =>
      executeTool('search_vector_compiler', extra, { provider: 'search-vector' }, async () => {
        const result = await compiler.compileVector({
          strategy,
          ...(random_seed !== undefined && { random_seed })
        });
        return {
          text: 'Generated a raw search vector seed lineage.',
          data: result
        };
      })
  );
}
