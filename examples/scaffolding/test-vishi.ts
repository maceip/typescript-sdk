/**
 * vishi - token savings demonstration
 *
 * this demo shows real token savings by calling the chatgpt api twice:
 * 1. traditional approach: pass all data to the model
 * 2. code execution pattern: use mcp server to filter data locally
 *
 * named "vishi" to honor the vision of efficient ai interactions.
 */

import { createServer } from '@modelcontextprotocol/server/scaffolding';
import { Client, StdioClientTransport } from '@modelcontextprotocol/client';
import * as z from 'zod';
import path from 'path';
import * as readline from 'readline/promises';
import OpenAI from 'openai';

console.log('═══════════════════════════════════════════════════════════════');
console.log('  vishi - real token efficiency demonstration');
console.log('  composable mcp codemode');
console.log('═══════════════════════════════════════════════════════════════\n');

// generate a large dataset (1,000 customer records for faster demo)
const generateLargeDataset = (size: number) => {
    return Array.from({ length: size }, (_, i) => ({
        id: `customer-${i}`,
        name: `customer ${i}`,
        email: `customer${i}@example.com`,
        phone: `+1-555-${String(i).padStart(7, '0')}`,
        address: `${i} main street, city ${i % 100}, state ${i % 50}, zip ${10000 + i}`,
        orderCount: Math.floor(Math.random() * 50),
        lifetimeValue: Math.floor(Math.random() * 100000),
        joinDate: new Date(Date.now() - Math.random() * 1000 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }));
};

const largeDataset = generateLargeDataset(1000);
const datasetJson = JSON.stringify(largeDataset, null, 2);

console.log('dataset generated:');
console.log(`   total records: ${largeDataset.length.toLocaleString()}`);
console.log(`   total size: ${(datasetJson.length / 1024).toFixed(2)} kb`);
console.log(`   estimated tokens: ~${Math.floor(datasetJson.length / 4).toLocaleString()}\n`);

console.log('═══════════════════════════════════════════════════════════════\n');

// prompt for api key
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('this demo requires a chatgpt api key to show real token usage.\n');
const apiKey = await rl.question('enter your chatgpt api key: ');
rl.close();

if (!apiKey || apiKey.trim() === '') {
    console.error('\nerror: api key required. exiting.\n');
    process.exit(1);
}

console.log('\n═══════════════════════════════════════════════════════════════\n');
console.log('starting real api demo\n');

try {
    const openai = new OpenAI({ apiKey: apiKey.trim() });

    // test 1: traditional approach - pass all data to model
    console.log('test 1: traditional approach (all data in context)\n');
    console.log('calling chatgpt api with full dataset...');

    const traditionalStart = Date.now();
    const traditionalResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 500,
        messages: [{
            role: 'user',
            content: `here is a customer database:\n\n${datasetJson}\n\nfind the top 5 customers with the most orders and tell me their names and order counts.`
        }]
    });
    const traditionalTime = Date.now() - traditionalStart;

    console.log(`completed in ${traditionalTime}ms\n`);
    console.log('response:', traditionalResponse.choices[0].message.content || '');
    console.log(`\ntoken usage:`);
    console.log(`   input: ${traditionalResponse.usage?.prompt_tokens.toLocaleString()}`);
    console.log(`   output: ${traditionalResponse.usage?.completion_tokens.toLocaleString()}`);
    console.log(`   total: ${((traditionalResponse.usage?.prompt_tokens || 0) + (traditionalResponse.usage?.completion_tokens || 0)).toLocaleString()}\n`);

    const traditionalCost = ((traditionalResponse.usage?.prompt_tokens || 0) * 0.150 / 1000000) +
                           ((traditionalResponse.usage?.completion_tokens || 0) * 0.600 / 1000000);
    console.log(`cost: $${traditionalCost.toFixed(6)}\n`);

    console.log('═══════════════════════════════════════════════════════════════\n');

    // test 2: code execution pattern - use mcp to filter locally
    console.log('test 2: code execution pattern (mcp server)\n');
    console.log('starting mcp server with local data filtering...');

    // create server code that will run in subprocess
    const serverCode = `
import { createServer } from '@modelcontextprotocol/server/scaffolding';
import { StdioServerTransport } from '@modelcontextprotocol/server';
import * as z from 'zod';

const largeDataset = ${JSON.stringify(largeDataset)};

const server = createServer('efficient-crm-server', '1.0.0')
    .module('crm', 'crm operations', m =>
        m.function(
            'getTopCustomers',
            'get top customers by order count',
            {
                inputSchema: z.object({
                    topN: z.number().default(5).describe('number of results')
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

const transport = new StdioServerTransport();
await server.connect(transport);
`;

    // write temporary server file
    const fs = await import('fs');
    const tmpServerPath = path.join(process.cwd(), '.vishi-server.mjs');
    fs.writeFileSync(tmpServerPath, serverCode);

    try {
        // start mcp client
        const client = new Client({
            name: 'vishi-client',
            version: '1.0.0'
        });

        const transport = new StdioClientTransport({
            command: 'node',
            args: [tmpServerPath]
        });

        await client.connect(transport);
        console.log('connected to mcp server');

        // call the mcp tool to get filtered results
        const mcpResult = await client.callTool({
            name: 'crm.getTopCustomers',
            arguments: { topN: 5 }
        });

        const filteredData = mcpResult.content[0].type === 'text' ? mcpResult.content[0].text : '';
        console.log('\nfiltered data from mcp server:');
        console.log(filteredData);

        await client.close();

        // now call chatgpt api with just the filtered results
        console.log('\ncalling chatgpt api with filtered results only...');

        const mcpStart = Date.now();
        const mcpResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            max_tokens: 500,
            messages: [{
                role: 'user',
                content: `here are the top 5 customers by order count:\n\n${filteredData}\n\ntell me about these customers.`
            }]
        });
        const mcpTime = Date.now() - mcpStart;

        console.log(`\ncompleted in ${mcpTime}ms\n`);
        console.log('response:', mcpResponse.choices[0].message.content || '');
        console.log(`\ntoken usage:`);
        console.log(`   input: ${mcpResponse.usage?.prompt_tokens.toLocaleString()}`);
        console.log(`   output: ${mcpResponse.usage?.completion_tokens.toLocaleString()}`);
        console.log(`   total: ${((mcpResponse.usage?.prompt_tokens || 0) + (mcpResponse.usage?.completion_tokens || 0)).toLocaleString()}\n`);

        const mcpCost = ((mcpResponse.usage?.prompt_tokens || 0) * 0.150 / 1000000) +
                       ((mcpResponse.usage?.completion_tokens || 0) * 0.600 / 1000000);
        console.log(`cost: $${mcpCost.toFixed(6)}\n`);

        // calculate savings
        const traditionalInputTokens = traditionalResponse.usage?.prompt_tokens || 0;
        const mcpInputTokens = mcpResponse.usage?.prompt_tokens || 0;
        const traditionalOutputTokens = traditionalResponse.usage?.completion_tokens || 0;
        const mcpOutputTokens = mcpResponse.usage?.completion_tokens || 0;

        const inputSavings = ((traditionalInputTokens - mcpInputTokens) / traditionalInputTokens) * 100;
        const totalTraditionalTokens = traditionalInputTokens + traditionalOutputTokens;
        const totalMcpTokens = mcpInputTokens + mcpOutputTokens;
        const totalSavings = ((totalTraditionalTokens - totalMcpTokens) / totalTraditionalTokens) * 100;
        const costSavings = traditionalCost - mcpCost;

        console.log('═══════════════════════════════════════════════════════════════\n');
        console.log('real comparison\n');
        console.log('┌──────────────────────┬──────────────┬──────────────┬─────────────┐');
        console.log('│ metric               │ traditional  │ mcp pattern  │ savings     │');
        console.log('├──────────────────────┼──────────────┼──────────────┼─────────────┤');
        console.log(`│ input tokens         │ ${String(traditionalInputTokens).padStart(12)} │ ${String(mcpInputTokens).padStart(12)} │ ${inputSavings.toFixed(1).padStart(10)}% │`);
        console.log(`│ output tokens        │ ${String(traditionalOutputTokens).padStart(12)} │ ${String(mcpOutputTokens).padStart(12)} │        n/a  │`);
        console.log('├──────────────────────┼──────────────┼──────────────┼─────────────┤');
        console.log(`│ total tokens         │ ${String(totalTraditionalTokens).padStart(12)} │ ${String(totalMcpTokens).padStart(12)} │ ${totalSavings.toFixed(1).padStart(10)}% │`);
        console.log(`│ cost per request     │ $${traditionalCost.toFixed(6).padStart(11)} │ $${mcpCost.toFixed(6).padStart(11)} │ $${costSavings.toFixed(6).padStart(10)} │`);
        console.log('└──────────────────────┴──────────────┴──────────────┴─────────────┘\n');

        console.log(`token reduction: ${totalSavings.toFixed(1)}%`);
        console.log(`cost reduction: $${costSavings.toFixed(6)} per request`);
        console.log(`at 10k requests/day: save ~$${(costSavings * 10000 * 30).toFixed(2)}/month\n`);

        console.log('═══════════════════════════════════════════════════════════════\n');
        console.log('reference: https://www.anthropic.com/engineering/code-execution-with-mcp\n');
        console.log('demonstration complete!');
        console.log('vishi - vision of efficient ai interactions');
        console.log('composable mcp codemode\n');

    } finally {
        // clean up temp file
        try {
            fs.unlinkSync(tmpServerPath);
        } catch (e) {
            // ignore
        }
    }

} catch (error: any) {
    console.error('\nerror:', error.message);
    process.exit(1);
}
