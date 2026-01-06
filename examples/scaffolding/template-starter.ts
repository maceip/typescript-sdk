/**
 * MCP Server Template - Get Started in 60 Seconds
 *
 * This is a minimal template for creating a code-execution optimized MCP server.
 * Copy this file and customize it for your use case.
 *
 * Run with: pnpm tsx examples/scaffolding/template-starter.ts
 */

import { createServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

// 1. Create your server
const server = createServer('my-custom-server', '1.0.0')
    .description('My custom MCP server description')

    // 2. Add a module (like a directory of related code)
    .module('mymodule', 'My module description', m =>
        m
            // 3. Add functions to the module
            .function(
                'myFunction',
                'What this function does',
                {
                    inputSchema: z.object({
                        input: z.string().describe('Input parameter')
                    })
                },
                async ({ input }, ctx) => {
                    // 4. Use the execution context

                    // Send progress updates
                    await ctx.notify('Starting operation...', 'info');

                    // Store state for later
                    await ctx.state.set('lastInput', input);

                    // Filter large data efficiently
                    const largeDataset = Array.from({ length: 10000 }, (_, i) => ({ id: i, value: i * 2 }));
                    const filtered = ctx.filter.filter(largeDataset, item => item.value > 100);
                    const top10 = ctx.filter.take(filtered, 10);

                    // Return result
                    return `Processed ${input}. Found ${filtered.length} items, returning top 10.`;
                }
            )

            // Add more functions...
            .function(
                'anotherFunction',
                'Another function description',
                async (_input, ctx) => {
                    // No input schema = no parameters
                    const lastInput = await ctx.state.get('lastInput');
                    return `Last input was: ${lastInput}`;
                }
            )
    )

    // Add more modules...
    .module('utilities', 'Utility functions', m =>
        m.function('help', 'Get help information', async () => {
            return `Available modules:
- mymodule: My module description
  - myFunction: What this function does
  - anotherFunction: Another function description
- utilities: Utility functions
  - help: Get help information`;
        })
    )

    .build();

// 5. Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('My Custom MCP Server is running!');
}

main().catch(error => {
    console.error('Server error:', error);
    process.exit(1);
});
