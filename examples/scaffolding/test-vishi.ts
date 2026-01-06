/**
 * Vishi - Token Savings Demonstration
 *
 * This demo shows REAL token savings by calling the Anthropic API twice:
 * 1. Traditional approach: Pass all data to the model
 * 2. Code execution pattern: Use MCP server to filter data locally
 *
 * Named "vishi" to honor the vision of efficient AI interactions.
 */

import { createServer } from '@modelcontextprotocol/server/scaffolding';
import { Client, StdioClientTransport } from '@modelcontextprotocol/client';
import * as z from 'zod';
import path from 'path';
import * as readline from 'readline/promises';

console.log('═══════════════════════════════════════════════════════════════');
console.log('  VISHI - Real Token Efficiency Demonstration');
console.log('═══════════════════════════════════════════════════════════════\n');

// Generate a large dataset (1,000 customer records for faster demo)
const generateLargeDataset = (size: number) => {
    return Array.from({ length: size }, (_, i) => ({
        id: `customer-${i}`,
        name: `Customer ${i}`,
        email: `customer${i}@example.com`,
        phone: `+1-555-${String(i).padStart(7, '0')}`,
        address: `${i} Main Street, City ${i % 100}, State ${i % 50}, ZIP ${10000 + i}`,
        orderCount: Math.floor(Math.random() * 50),
        lifetimeValue: Math.floor(Math.random() * 100000),
        joinDate: new Date(Date.now() - Math.random() * 1000 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }));
};

const largeDataset = generateLargeDataset(1000);
const datasetJson = JSON.stringify(largeDataset, null, 2);

console.log('📊 Dataset Generated:');
console.log(`   Total records: ${largeDataset.length.toLocaleString()}`);
console.log(`   Total size: ${(datasetJson.length / 1024).toFixed(2)} KB`);
console.log(`   Estimated tokens: ~${Math.floor(datasetJson.length / 4).toLocaleString()}\n`);

console.log('═══════════════════════════════════════════════════════════════\n');

// Prompt for API key
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('This demo will call the Anthropic API to show REAL token usage.\n');
const apiKey = await rl.question('Enter your Anthropic API key (or press Enter to skip): ');
rl.close();

if (!apiKey || apiKey.trim() === '') {
    console.log('\n⚠️  No API key provided. Running in simulation mode...\n');
    runSimulation();
} else {
    await runRealDemo(apiKey.trim());
}

function runSimulation() {
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('📊 SIMULATION MODE\n');

    const datasetTokens = Math.floor(datasetJson.length / 4);
    const queryTokens = 50;
    const responseTokens = 200;

    console.log('Traditional Approach:');
    console.log(`  Input: ${datasetTokens.toLocaleString()} (dataset) + ${queryTokens} (query) = ${(datasetTokens + queryTokens).toLocaleString()} tokens`);
    console.log(`  Output: ~${responseTokens} tokens`);
    console.log(`  Total: ~${(datasetTokens + queryTokens + responseTokens).toLocaleString()} tokens\n`);

    const mcpResultTokens = 200;
    console.log('Code Execution Pattern (MCP):');
    console.log(`  Input: ${mcpResultTokens} (filtered result) + ${queryTokens} (query) = ${(mcpResultTokens + queryTokens).toLocaleString()} tokens`);
    console.log(`  Output: ~${responseTokens} tokens`);
    console.log(`  Total: ~${(mcpResultTokens + queryTokens + responseTokens).toLocaleString()} tokens\n`);

    const savings = ((datasetTokens + queryTokens + responseTokens - (mcpResultTokens + queryTokens + responseTokens)) / (datasetTokens + queryTokens + responseTokens)) * 100;

    console.log(`💰 Token Savings: ${savings.toFixed(1)}%`);
    console.log(`💵 Cost Savings: ~$${((datasetTokens * 3 / 1000000) * 0.99).toFixed(4)} per request`);
    console.log(`🌍 At 10K requests/day: ~$${(((datasetTokens * 3 / 1000000) * 0.99) * 10000 * 30).toFixed(2)}/month saved\n`);

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('✅ Simulation complete!');
    console.log('   Run with an API key to see real token counts.\n');
}

async function runRealDemo(apiKey: string) {
    console.log('\n═══════════════════════════════════════════════════════════════\n');
    console.log('🚀 Starting Real API Demo\n');

    try {
        // Dynamic import of Anthropic SDK
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const anthropic = new Anthropic({ apiKey });

        // TEST 1: Traditional Approach - Pass all data to model
        console.log('📋 TEST 1: Traditional Approach (All Data in Context)\n');
        console.log('Calling Anthropic API with full dataset...');

        const traditionalStart = Date.now();
        const traditionalResponse = await anthropic.messages.create({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 500,
            messages: [{
                role: 'user',
                content: `Here is a customer database:\n\n${datasetJson}\n\nFind the top 5 customers with the most orders and tell me their names and order counts.`
            }]
        });
        const traditionalTime = Date.now() - traditionalStart;

        console.log(`✅ Completed in ${traditionalTime}ms\n`);
        console.log('Response:', traditionalResponse.content[0].type === 'text' ? traditionalResponse.content[0].text : '');
        console.log(`\n📊 Token Usage:`);
        console.log(`   Input: ${traditionalResponse.usage.input_tokens.toLocaleString()}`);
        console.log(`   Output: ${traditionalResponse.usage.output_tokens.toLocaleString()}`);
        console.log(`   Total: ${(traditionalResponse.usage.input_tokens + traditionalResponse.usage.output_tokens).toLocaleString()}\n`);

        const traditionalCost = (traditionalResponse.usage.input_tokens * 1.00 / 1000000) +
                               (traditionalResponse.usage.output_tokens * 5.00 / 1000000);
        console.log(`💵 Cost: $${traditionalCost.toFixed(6)}\n`);

        console.log('═══════════════════════════════════════════════════════════════\n');

        // TEST 2: Code Execution Pattern - Use MCP to filter locally
        console.log('📋 TEST 2: Code Execution Pattern (MCP Server)\n');
        console.log('Starting MCP server with local data filtering...');

        // Create server code that will run in subprocess
        const serverCode = `
import { createServer } from '@modelcontextprotocol/server/scaffolding';
import * as z from 'zod';

const largeDataset = ${JSON.stringify(largeDataset)};

const server = createServer('efficient-crm-server', '1.0.0')
    .module('crm', 'CRM operations', m =>
        m.function(
            'getTopCustomers',
            'Get top customers by order count',
            {
                inputSchema: z.object({
                    topN: z.number().default(5).describe('Number of results')
                })
            },
            async ({ topN }, ctx) => {
                const sorted = ctx.filter.sort(largeDataset, (a, b) => b.orderCount - a.orderCount);
                const topResults = ctx.filter.take(sorted, topN);

                return {
                    content: [{
                        type: 'text',
                        text: topResults.map(c =>
                            \`- \${c.name} (\${c.email}): \${c.orderCount} orders\`
                        ).join('\\n')
                    }]
                };
            }
        )
    )
    .build();

await server.start();
`;

        // Write temporary server file
        const fs = await import('fs');
        const tmpServerPath = path.join(process.cwd(), '.vishi-server.mjs');
        fs.writeFileSync(tmpServerPath, serverCode);

        try {
            // Start MCP client
            const client = new Client({
                name: 'vishi-client',
                version: '1.0.0'
            });

            const transport = new StdioClientTransport({
                command: 'node',
                args: [tmpServerPath]
            });

            await client.connect(transport);
            console.log('✅ Connected to MCP server');

            // Call the MCP tool to get filtered results
            const mcpResult = await client.callTool({
                name: 'crm.getTopCustomers',
                arguments: { topN: 5 }
            });

            const filteredData = mcpResult.content[0].type === 'text' ? mcpResult.content[0].text : '';
            console.log('\n✅ Filtered data from MCP server:');
            console.log(filteredData);

            await client.close();

            // Now call Anthropic API with just the filtered results
            console.log('\nCalling Anthropic API with filtered results only...');

            const mcpStart = Date.now();
            const mcpResponse = await anthropic.messages.create({
                model: 'claude-3-5-haiku-20241022',
                max_tokens: 500,
                messages: [{
                    role: 'user',
                    content: `Here are the top 5 customers by order count:\n\n${filteredData}\n\nTell me about these customers.`
                }]
            });
            const mcpTime = Date.now() - mcpStart;

            console.log(`\n✅ Completed in ${mcpTime}ms\n`);
            console.log('Response:', mcpResponse.content[0].type === 'text' ? mcpResponse.content[0].text : '');
            console.log(`\n📊 Token Usage:`);
            console.log(`   Input: ${mcpResponse.usage.input_tokens.toLocaleString()}`);
            console.log(`   Output: ${mcpResponse.usage.output_tokens.toLocaleString()}`);
            console.log(`   Total: ${(mcpResponse.usage.input_tokens + mcpResponse.usage.output_tokens).toLocaleString()}\n`);

            const mcpCost = (mcpResponse.usage.input_tokens * 1.00 / 1000000) +
                           (mcpResponse.usage.output_tokens * 5.00 / 1000000);
            console.log(`💵 Cost: $${mcpCost.toFixed(6)}\n`);

            // Calculate savings
            const inputSavings = ((traditionalResponse.usage.input_tokens - mcpResponse.usage.input_tokens) / traditionalResponse.usage.input_tokens) * 100;
            const totalTraditionalTokens = traditionalResponse.usage.input_tokens + traditionalResponse.usage.output_tokens;
            const totalMcpTokens = mcpResponse.usage.input_tokens + mcpResponse.usage.output_tokens;
            const totalSavings = ((totalTraditionalTokens - totalMcpTokens) / totalTraditionalTokens) * 100;
            const costSavings = traditionalCost - mcpCost;

            console.log('═══════════════════════════════════════════════════════════════\n');
            console.log('📊 REAL COMPARISON\n');
            console.log('┌──────────────────────┬──────────────┬──────────────┬─────────────┐');
            console.log('│ Metric               │ Traditional  │ MCP Pattern  │ Savings     │');
            console.log('├──────────────────────┼──────────────┼──────────────┼─────────────┤');
            console.log(`│ Input Tokens         │ ${String(traditionalResponse.usage.input_tokens).padStart(12)} │ ${String(mcpResponse.usage.input_tokens).padStart(12)} │ ${inputSavings.toFixed(1).padStart(10)}% │`);
            console.log(`│ Output Tokens        │ ${String(traditionalResponse.usage.output_tokens).padStart(12)} │ ${String(mcpResponse.usage.output_tokens).padStart(12)} │        N/A  │`);
            console.log('├──────────────────────┼──────────────┼──────────────┼─────────────┤');
            console.log(`│ Total Tokens         │ ${String(totalTraditionalTokens).padStart(12)} │ ${String(totalMcpTokens).padStart(12)} │ ${totalSavings.toFixed(1).padStart(10)}% │`);
            console.log(`│ Cost per Request     │ $${traditionalCost.toFixed(6).padStart(11)} │ $${mcpCost.toFixed(6).padStart(11)} │ $${costSavings.toFixed(6).padStart(10)} │`);
            console.log('└──────────────────────┴──────────────┴──────────────┴─────────────┘\n');

            console.log(`💰 Token Reduction: ${totalSavings.toFixed(1)}%`);
            console.log(`💵 Cost Reduction: $${costSavings.toFixed(6)} per request`);
            console.log(`🌍 At 10K requests/day: Save ~$${(costSavings * 10000 * 30).toFixed(2)}/month\n`);

            console.log('═══════════════════════════════════════════════════════════════\n');
            console.log('📚 Reference: https://www.anthropic.com/engineering/code-execution-with-mcp\n');
            console.log('✅ Real demonstration complete!');
            console.log('   Vishi - Vision of Efficient AI Interactions ✨\n');

        } finally {
            // Clean up temp file
            try {
                fs.unlinkSync(tmpServerPath);
            } catch (e) {
                // Ignore
            }
        }

    } catch (error: any) {
        if (error.message?.includes('Cannot find package')) {
            console.error('\n❌ Anthropic SDK not installed.');
            console.error('   Install it with: pnpm add @anthropic-ai/sdk\n');
            console.log('Running in simulation mode instead...\n');
            runSimulation();
        } else {
            console.error('\n❌ Demo failed:', error.message);
            console.log('\nRunning in simulation mode instead...\n');
            runSimulation();
        }
    }
}
