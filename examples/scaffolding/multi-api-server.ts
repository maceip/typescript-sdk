/**
 * Multi-API Integration Server
 *
 * Demonstrates the pattern from the Anthropic article:
 * https://www.anthropic.com/engineering/code-execution-with-mcp
 *
 * Instead of exposing 1000s of individual tools, we organize APIs
 * as code modules that agents can discover progressively.
 *
 * Run with: pnpm tsx examples/scaffolding/multi-api-server.ts
 */

import { createServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

// Mock API clients (in real usage, these would be actual API libraries)
const mockGoogleDriveApi = {
    async getDocument(id: string) {
        return {
            id,
            name: `Document ${id}`,
            content: `This is a mock transcript of a 2-hour meeting. It's very long... [50,000 tokens of content would normally go here]`,
            metadata: { created: new Date(), size: 50000 }
        };
    }
};

const mockSalesforceApi = {
    async updateRecord(id: string, data: any) {
        return { id, success: true, updated: data };
    },
    async searchRecords(query: string) {
        // Mock: return 1000s of records
        return Array.from({ length: 10000 }, (_, i) => ({
            id: `record-${i}`,
            name: `Record ${i}`,
            score: Math.random()
        }));
    }
};

// Create the server with filesystem-like API organization
const server = createServer('multi-api-integration-server', '1.0.0')
    .description('Integration with Google Drive and Salesforce - optimized for code execution')
    .module('google-drive', 'Google Drive operations', m =>
        m
            .function(
                'getDocument',
                'Retrieve a document from Google Drive',
                {
                    inputSchema: z.object({
                        documentId: z.string(),
                        maxLength: z.number().optional().describe('Maximum content length to return')
                    })
                },
                async ({ documentId, maxLength }, ctx) => {
                    await ctx.notify(`Fetching document ${documentId} from Google Drive`);

                    const doc = await mockGoogleDriveApi.getDocument(documentId);

                    // KEY INSIGHT: Filter large content HERE, not through the model
                    let content = doc.content;
                    if (maxLength && content.length > maxLength) {
                        content = content.substring(0, maxLength) + '... [truncated]';
                        await ctx.notify(`Truncated content from ${doc.content.length} to ${maxLength} chars`);
                    }

                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Document: ${doc.name}\nSize: ${doc.metadata.size} chars\n\n${content}`
                            }
                        ]
                    };
                }
            )
            .function(
                'searchDocuments',
                'Search for documents',
                {
                    inputSchema: z.object({
                        query: z.string(),
                        limit: z.number().default(10)
                    })
                },
                async ({ query, limit }, ctx) => {
                    // Mock search results
                    const results = Array.from({ length: 100 }, (_, i) => ({
                        id: `doc-${i}`,
                        name: `${query} - Document ${i}`,
                        relevance: Math.random()
                    }));

                    // Filter in execution environment
                    const topResults = ctx.filter.sort(results, (a, b) => b.relevance - a.relevance);
                    const limited = ctx.filter.take(topResults, limit);

                    return `Found ${results.length} documents matching "${query}"\n\nTop ${limit} results:\n${JSON.stringify(limited, null, 2)}`;
                }
            )
    )
    .module('salesforce', 'Salesforce CRM operations', m =>
        m
            .function(
                'updateRecord',
                'Update a Salesforce record',
                {
                    inputSchema: z.object({
                        recordId: z.string(),
                        data: z.record(z.any())
                    })
                },
                async ({ recordId, data }, ctx) => {
                    await ctx.notify(`Updating Salesforce record ${recordId}`);

                    const result = await mockSalesforceApi.updateRecord(recordId, data);

                    return `Successfully updated record ${recordId}`;
                }
            )
            .function(
                'searchRecords',
                'Search Salesforce records with filtering',
                {
                    inputSchema: z.object({
                        query: z.string(),
                        filterField: z.string().optional(),
                        filterValue: z.any().optional(),
                        topN: z.number().default(10)
                    })
                },
                async ({ query, filterField, filterValue, topN }, ctx) => {
                    await ctx.notify(`Searching Salesforce for "${query}"`);

                    // This could return 10,000+ records
                    let results = await mockSalesforceApi.searchRecords(query);

                    await ctx.notify(`Found ${results.length} records, filtering...`);

                    // KEY INSIGHT: Filter 10,000 records HERE in execution environment
                    // Not by passing them all through the model!
                    if (filterField && filterValue !== undefined) {
                        results = ctx.filter.filter(results, (r: any) => r[filterField] === filterValue);
                    }

                    // Sort and take top N
                    const sorted = ctx.filter.sort(results, (a, b) => b.score - a.score);
                    const top = ctx.filter.take(sorted, topN);

                    return `Searched ${query}, filtered ${results.length} records, returning top ${topN}:\n\n${JSON.stringify(top, null, 2)}`;
                }
            )
    )
    .module('workflows', 'Cross-API workflows', m =>
        m.function(
            'attachMeetingToCRM',
            'Download meeting transcript and attach to CRM record',
            {
                inputSchema: z.object({
                    meetingDocId: z.string(),
                    crmRecordId: z.string(),
                    summarize: z.boolean().default(true)
                })
            },
            async ({ meetingDocId, crmRecordId, summarize }, ctx) => {
                // KEY INSIGHT from article: This avoids passing 50,000 token transcript
                // through the model context twice!

                await ctx.notify('Step 1: Downloading meeting transcript from Google Drive');
                const doc = await mockGoogleDriveApi.getDocument(meetingDocId);

                let content = doc.content;
                if (summarize) {
                    await ctx.notify('Step 2: Summarizing transcript locally');
                    // In real implementation, you might use a local LLM or extraction logic
                    content = `[Summary of ${doc.metadata.size} char transcript]`;
                }

                await ctx.notify('Step 3: Attaching to Salesforce record');
                await mockSalesforceApi.updateRecord(crmRecordId, {
                    meeting_notes: content,
                    meeting_doc_id: meetingDocId
                });

                return `Successfully attached meeting transcript to CRM record ${crmRecordId}. ${summarize ? 'Attached summary instead of full transcript to save tokens.' : ''}`;
            }
        )
    )
    .build();

// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('Multi-API Integration MCP Server running on stdio');
    console.error('');
    console.error('Available modules:');
    console.error('  google-drive/');
    console.error('    - getDocument: Fetch documents with smart truncation');
    console.error('    - searchDocuments: Search with result filtering');
    console.error('  salesforce/');
    console.error('    - updateRecord: Update CRM records');
    console.error('    - searchRecords: Search 10,000+ records efficiently');
    console.error('  workflows/');
    console.error('    - attachMeetingToCRM: Multi-step workflow without context bloat');
    console.error('');
    console.error('Token savings: ~98.7% compared to exposing all APIs as individual tools');
}

main().catch(error => {
    console.error('Server error:', error);
    process.exit(1);
});
