/**
 * Test Client for MCP Scaffolding Demo
 *
 * Connects to the template-starter server and exercises its functionality
 */

import { Client, StdioClientTransport } from '@modelcontextprotocol/client';
import path from 'path';

async function main() {
    console.log('🚀 Starting MCP Client Test...\n');

    // Create client
    const client = new Client({
        name: 'test-client',
        version: '1.0.0'
    });

    // Create transport that spawns the server
    const serverPath = path.join(process.cwd(), 'template-starter.ts');
    const transport = new StdioClientTransport({
        command: 'tsx',
        args: [serverPath]
    });

    await client.connect(transport);
    console.log('✅ Connected to MCP server\n');

    try {
        // Test 1: List available tools
        console.log('📋 Listing available tools...');
        const tools = await client.listTools();
        console.log(`Found ${tools.tools.length} tools:`);
        tools.tools.forEach(tool => {
            console.log(`  - ${tool.name}: ${tool.description}`);
        });
        console.log('');

        // Test 2: Call myFunction with input
        console.log('🔧 Testing mymodule.myFunction...');
        const result1 = await client.callTool({
            name: 'mymodule.myFunction',
            arguments: {
                input: 'Hello from test client!'
            }
        });
        console.log('Response:', result1.content[0]);
        console.log('');

        // Test 3: Call anotherFunction (no parameters)
        console.log('🔧 Testing mymodule.anotherFunction...');
        const result2 = await client.callTool({
            name: 'mymodule.anotherFunction',
            arguments: {}
        });
        console.log('Response:', result2.content[0]);
        console.log('');

        // Test 4: Call help utility
        console.log('❓ Testing utilities.help...');
        const result3 = await client.callTool({
            name: 'utilities.help',
            arguments: {}
        });
        console.log('Response:');
        console.log(result3.content[0]);
        console.log('');

        console.log('✅ All tests passed!\n');
        console.log('═══════════════════════════════════════');
        console.log('MCP Scaffolding Demo Complete!');
        console.log('═══════════════════════════════════════');

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    } finally {
        // Clean up
        await client.close();
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
