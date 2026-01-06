/**
 * Simple Data Processing Server
 *
 * Demonstrates the code execution pattern with data filtering.
 * Instead of passing large datasets through the model, we filter them
 * in the execution environment.
 *
 * Run with: pnpm tsx examples/scaffolding/simple-data-server.ts
 */

import { createServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

// Create a server with filesystem-like organization
const server = createServer('data-processing-server', '1.0.0')
    .description('Efficiently process large datasets without context bloat')
    .module('data', 'Data processing operations', m =>
        m
            .function(
                'filterRecords',
                'Filter large datasets based on criteria',
                {
                    inputSchema: z.object({
                        records: z.array(z.any()),
                        field: z.string(),
                        value: z.any()
                    })
                },
                async ({ records, field, value }, ctx) => {
                    // Log what we're doing
                    await ctx.notify(`Filtering ${records.length} records by ${field}=${value}`);

                    // Filter in execution environment (not through model!)
                    const filtered = ctx.filter.filter(records, (r: any) => r[field] === value);

                    await ctx.notify(`Found ${filtered.length} matching records`);

                    // Return summary, not full data
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Filtered ${records.length} records down to ${filtered.length} matches.\n\nFirst 5 results:\n${JSON.stringify(ctx.filter.take(filtered, 5), null, 2)}`
                            }
                        ]
                    };
                }
            )
            .function(
                'summarize',
                'Summarize numeric data',
                {
                    inputSchema: z.object({
                        data: z.array(z.any()),
                        field: z.string()
                    })
                },
                async ({ data, field }, ctx) => {
                    await ctx.notify(`Aggregating ${field} from ${data.length} records`);

                    // Aggregate in execution environment
                    const stats = ctx.filter.aggregate(data, field);

                    return `Summary of ${field}:
- Count: ${stats.count}
- Sum: ${stats.sum}
- Average: ${stats.avg.toFixed(2)}
- Min: ${stats.min}
- Max: ${stats.max}`;
                }
            )
            .function(
                'paginate',
                'Get a specific page of data',
                {
                    inputSchema: z.object({
                        data: z.array(z.any()),
                        page: z.number().default(1),
                        pageSize: z.number().default(10)
                    })
                },
                async ({ data, page, pageSize }, ctx) => {
                    const result = ctx.filter.paginate(data, page, pageSize);

                    return `Page ${page} of ${result.pages} (${result.total} total items):

${JSON.stringify(result.items, null, 2)}`;
                }
            )
    )
    .module('analysis', 'Data analysis operations', m =>
        m
            .function(
                'groupBy',
                'Group data by a field',
                {
                    inputSchema: z.object({
                        data: z.array(z.any()),
                        field: z.string()
                    })
                },
                async ({ data, field }, ctx) => {
                    const grouped = ctx.filter.groupBy(data, (item: any) => String(item[field]));

                    const summary = Object.entries(grouped)
                        .map(([key, items]) => `${key}: ${items.length} items`)
                        .join('\n');

                    return `Grouped by ${field}:\n${summary}`;
                }
            )
            .function(
                'topN',
                'Get top N items by a field',
                {
                    inputSchema: z.object({
                        data: z.array(z.any()),
                        field: z.string(),
                        n: z.number().default(10),
                        ascending: z.boolean().default(false)
                    })
                },
                async ({ data, field, n, ascending }, ctx) => {
                    const sorted = ctx.filter.sort(data, (a: any, b: any) => {
                        const aVal = Number(a[field]);
                        const bVal = Number(b[field]);
                        return ascending ? aVal - bVal : bVal - aVal;
                    });

                    const top = ctx.filter.take(sorted, n);

                    return `Top ${n} by ${field}:\n${JSON.stringify(top, null, 2)}`;
                }
            )
    )
    .build();

// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('Data Processing MCP Server running on stdio');
    console.error('Tools available:');
    console.error('  - data.filterRecords: Filter large datasets efficiently');
    console.error('  - data.summarize: Aggregate numeric data');
    console.error('  - data.paginate: Paginate through results');
    console.error('  - analysis.groupBy: Group data by field');
    console.error('  - analysis.topN: Get top N items');
}

main().catch(error => {
    console.error('Server error:', error);
    process.exit(1);
});
