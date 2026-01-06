# MCP Server Scaffolding Examples

Dead simple MCP server creation using the **code execution pattern** from [Anthropic's Engineering Blog](https://www.anthropic.com/engineering/code-execution-with-mcp).

## 🎯 Why Use This Pattern?

Traditional MCP servers expose individual tools, loading all definitions upfront. This consumes massive context:

- ❌ **150,000 tokens** to load 1000s of tool definitions
- ❌ **50,000+ tokens** for intermediate results passed through the model
- ❌ High latency and costs

The code execution pattern changes this:

- ✅ **2,000 tokens** with progressive tool disclosure (**98.7% reduction**)
- ✅ Data filtering happens in the execution environment
- ✅ Filesystem-like tool organization
- ✅ Built-in state management

## 🚀 Quick Start

### 1. Use the Template (Fastest)

```bash
cp examples/scaffolding/template-starter.ts my-server.ts
pnpm tsx my-server.ts
```

### 2. Build from Scratch

```typescript
import { createServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server';
import * as z from 'zod';

const server = createServer('my-server', '1.0.0')
  .module('data', 'Data operations', m =>
    m.function(
      'filter',
      'Filter large datasets efficiently',
      { inputSchema: z.object({ data: z.array(z.any()) }) },
      async ({ data }, ctx) => {
        // Filter 10,000 records HERE, not through the model!
        const filtered = ctx.filter.filter(data, item => item.active);
        const top10 = ctx.filter.take(filtered, 10);
        return `Filtered ${data.length} → ${filtered.length} records`;
      }
    )
  )
  .build();

const transport = new StdioServerTransport();
await server.connect(transport);
```

## 📚 Examples

### [simple-data-server.ts](./simple-data-server.ts)

Basic data processing with filtering, pagination, and aggregation.

```bash
pnpm tsx examples/scaffolding/simple-data-server.ts
```

**Tools:**
- `data.filterRecords` - Filter large datasets by criteria
- `data.summarize` - Aggregate numeric data
- `data.paginate` - Paginate through results
- `analysis.groupBy` - Group data by field
- `analysis.topN` - Get top N items

### [multi-api-server.ts](./multi-api-server.ts)

Multi-API integration (Google Drive + Salesforce) showing the pattern from the article.

```bash
pnpm tsx examples/scaffolding/multi-api-server.ts
```

**Demonstrates:**
- Progressive API discovery
- Smart data truncation
- Cross-API workflows without context bloat
- 98.7% token reduction vs traditional approach

### [template-starter.ts](./template-starter.ts)

Minimal template to copy and customize.

## 🧱 Core Concepts

### Filesystem-Like Organization

Tools are organized like code in directories:

```
servers/
├── google-drive/
│   ├── getDocument
│   └── searchDocuments
└── salesforce/
    ├── updateRecord
    └── searchRecords
```

Agents discover tools progressively, not all at once.

### Execution Context

Every function receives a powerful execution context:

```typescript
async function myFunction(input, ctx) {
  // Send progress updates
  await ctx.notify('Processing...', 'info');

  // Filter large data efficiently
  const filtered = ctx.filter.filter(largeData, item => item.active);
  const top10 = ctx.filter.take(filtered, 10);

  // Persist state
  await ctx.state.set('lastResult', filtered);

  // Use helper methods
  const stats = ctx.filter.aggregate(data, 'revenue');
  const grouped = ctx.filter.groupBy(data, item => item.category);

  return result;
}
```

### Data Filtering

Process large datasets **in the execution environment**, not through the model:

```typescript
// ❌ BAD: Pass 10,000 records through model context
const allRecords = await api.search(); // 10,000 items
return JSON.stringify(allRecords); // Huge token cost!

// ✅ GOOD: Filter in execution environment
const allRecords = await api.search(); // 10,000 items
const filtered = ctx.filter.filter(allRecords, r => r.active);
const top10 = ctx.filter.take(filtered, 10);
return JSON.stringify(top10); // Minimal tokens!
```

### Available Filter Methods

```typescript
ctx.filter.filter(data, predicate)     // Filter by condition
ctx.filter.take(data, n)                // Take first N items
ctx.filter.skip(data, n)                // Skip first N items
ctx.filter.map(data, mapper)            // Transform items
ctx.filter.reduce(data, fn, initial)    // Reduce to value
ctx.filter.groupBy(data, keyFn)         // Group by key
ctx.filter.unique(data, keyFn?)         // Get unique values
ctx.filter.sort(data, compareFn?)       // Sort items
ctx.filter.paginate(data, page, size)   // Paginate results
ctx.filter.pluck(data, field)           // Extract field
ctx.filter.find(data, predicate)        // Find one item
ctx.filter.count(data, predicate?)      // Count items
ctx.filter.aggregate(data, field)       // Get sum/avg/min/max
```

## 🏗️ Building Your Server

### Step 1: Define Your Modules

Think of modules as directories of related code:

```typescript
const server = createServer('my-server', '1.0.0')
  .module('users', 'User management', m => {
    // Add user-related functions
  })
  .module('data', 'Data operations', m => {
    // Add data functions
  })
```

### Step 2: Add Functions

Each function is like a file in the directory:

```typescript
.module('users', 'User management', m =>
  m
    .function('create', 'Create a user',
      { inputSchema: z.object({ name: z.string() }) },
      async ({ name }, ctx) => { /* ... */ }
    )
    .function('list', 'List users',
      { inputSchema: z.object({ limit: z.number() }) },
      async ({ limit }, ctx) => { /* ... */ }
    )
)
```

### Step 3: Use the Context

Every function gets an execution context with powerful utilities:

```typescript
async ({ input }, ctx) => {
  // Notifications
  await ctx.notify('Starting...', 'info');

  // State management
  await ctx.state.set('key', value);
  const val = await ctx.state.get('key');

  // Data filtering
  const filtered = ctx.filter.filter(bigData, item => item.active);

  // Session info
  console.log(ctx.sessionId);

  return result;
}
```

### Step 4: Connect and Run

```typescript
const server = /* ... */.build();

const transport = new StdioServerTransport();
await server.connect(transport);
```

## 🎨 Design Patterns

### Pattern 1: Progressive Disclosure

```typescript
// Instead of exposing 1000 tools at once:
// ❌ tool('gmail_send'), tool('gmail_read'), tool('gmail_delete'), ...

// Organize hierarchically:
// ✅ gmail.send, gmail.read, gmail.delete
.module('gmail', 'Gmail operations', m =>
  m.function('send', ...)
   .function('read', ...)
   .function('delete', ...)
)
```

### Pattern 2: Data Filtering

```typescript
// Filter large datasets in execution environment
.function('searchProducts', 'Search products',
  { inputSchema: z.object({ query: z.string() }) },
  async ({ query }, ctx) => {
    const allProducts = await api.search(query); // Could be 10,000 items

    // Filter HERE, not through model
    const inStock = ctx.filter.filter(allProducts, p => p.stock > 0);
    const sorted = ctx.filter.sort(inStock, (a, b) => b.rating - a.rating);
    const top20 = ctx.filter.take(sorted, 20);

    return `Found ${allProducts.length} products, ${inStock.length} in stock. Top 20:\n${JSON.stringify(top20)}`;
  }
)
```

### Pattern 3: Cross-API Workflows

```typescript
// Combine multiple APIs without context bloat
.function('attachDocumentToRecord', 'Attach doc to CRM',
  async ({ docId, recordId }, ctx) => {
    // Step 1: Fetch document (could be 50,000 tokens)
    await ctx.notify('Downloading document...');
    const doc = await driveApi.getDocument(docId);

    // Step 2: Summarize locally (don't pass full doc through model)
    const summary = doc.content.substring(0, 500) + '...';

    // Step 3: Attach to CRM
    await ctx.notify('Attaching to CRM...');
    await crmApi.updateRecord(recordId, { attachment: summary });

    return 'Attached document summary to CRM record';
  }
)
```

### Pattern 4: Stateful Operations

```typescript
// Persist intermediate results
.function('startAnalysis', 'Start long analysis',
  async ({ data }, ctx) => {
    const results = await longRunningAnalysis(data);

    // Store for later retrieval
    await ctx.state.set('analysis_results', results);
    await ctx.state.set('analysis_timestamp', Date.now());

    return 'Analysis complete, results stored';
  }
)
.function('getAnalysis', 'Get analysis results',
  async (_, ctx) => {
    const results = await ctx.state.get('analysis_results');
    const timestamp = await ctx.state.get('analysis_timestamp');

    return `Results from ${new Date(timestamp)}:\n${JSON.stringify(results)}`;
  }
)
```

## 🔧 API Reference

### `createServer(name, version)`

Create a new server builder.

```typescript
const server = createServer('my-server', '1.0.0')
  .description('Server description')
  .module(...)
  .build();
```

### `server.module(name, description, builder)`

Add a module to organize related functions.

```typescript
.module('mymodule', 'Module description', m =>
  m.function(...)
   .function(...)
)
```

### `module.function(name, description, config?, execute)`

Add a function to a module.

```typescript
// With input schema
m.function('myFunc', 'Description',
  { inputSchema: z.object({ ... }) },
  async ({ input }, ctx) => { ... }
)

// Without input schema
m.function('noInput', 'Description',
  async (_, ctx) => { ... }
)
```

### `ExecutionContext`

Available in every function:

- `ctx.sessionId` - Current session ID
- `ctx.filter` - Data filtering utilities
- `ctx.state` - Persistent state storage
- `ctx.notify(message, level?)` - Send progress notifications
- `ctx.extra` - Raw MCP request handler extra

## 📊 Performance Comparison

| Approach | Token Usage | Latency | Cost |
|----------|-------------|---------|------|
| Traditional (1000 tools) | ~150,000 | High | High |
| Code Execution Pattern | ~2,000 | Low | Low |
| **Improvement** | **98.7% reduction** | **Faster** | **98%+ cheaper** |

## 🤝 Contributing

Found a useful pattern? Submit a PR with a new example!

## 📖 Learn More

- [Code Execution with MCP (Anthropic Blog)](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [MCP Specification](https://modelcontextprotocol.io)
- [TypeScript SDK Docs](https://github.com/modelcontextprotocol/typescript-sdk)
