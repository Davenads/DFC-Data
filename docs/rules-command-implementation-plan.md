# Rules Command Implementation Plan

## Executive Summary

This document outlines the complete implementation plan for a `/rules` Discord command that displays DFC tournament rules with Google Docs integration and Redis caching. The command will support filtering by class and format, with automatic cache synchronization from a source Google Doc.

**Status:** Ready for Implementation
**Complexity:** Medium
**Estimated Components:** 5 files (1 command, 2 utilities, 2 config updates)

---

## Table of Contents

1. [Feasibility Assessment](#feasibility-assessment)
2. [Document Structure Analysis](#document-structure-analysis)
3. [Command Design](#command-design)
4. [Implementation Components](#implementation-components)
5. [Caching Strategy](#caching-strategy)
6. [Technical Considerations](#technical-considerations)
7. [Testing Plan](#testing-plan)

---

## Feasibility Assessment

### Current Infrastructure

**✅ All Prerequisites Met:**

1. **Google Docs API Available** - googleapis v144 package includes Docs API
2. **Authentication Ready** - JWT service account auth already configured
3. **Caching Pattern Established** - Redis with graceful fallback exists
4. **Redis Infrastructure** - Running and integrated with 1-week TTL
5. **Scheduled Refresh System** - 3x weekly cron jobs in place

### Existing Caching Pattern

All cache implementations follow this proven pattern:

```javascript
class CacheName {
  constructor() {
    this.isRefreshing = false;
  }

  async getCachedData()      // Try Redis → fallback to live fetch
  async fetchLiveData()      // Fetch from Google API
  async refreshCache()       // Update Redis with TTL
  async getCacheTimestamp()  // Get last refresh time
  async isCacheStale()      // Check if refresh needed
}
```

**Common Features:**
- Redis-first architecture with Google API fallback
- 1-week TTL (604800 seconds) for all caches
- Mutex pattern (`isRefreshing` flag) prevents concurrent refreshes
- Graceful degradation when Redis fails
- Singleton pattern for efficiency

### Implementation Comparison

| Aspect | Complexity | Rationale |
|--------|-----------|-----------|
| Google Docs API Integration | Low | Already authenticated, just add scope |
| Document Parsing | Low-Medium | Highly structured markdown format |
| Caching Implementation | Low | Copy existing pattern |
| Cache Refresh Integration | Low | Add to existing cron jobs |
| Command Implementation | Medium | Multiple parameters, navigation menu |
| **Overall Complexity** | **Medium** | Well-defined patterns, clear structure |

---

## Document Structure Analysis

### File Specifications

**Source:** `Official-DFC-Rules.md` (exported from Google Docs)
**Size:** 357 lines, ~30KB text + 1 base64 image (~30KB)
**Format:** Standard Markdown with minor Google Docs quirks

### Major Sections

```
Lines 1-10:   Title & Introduction
Lines 13-30:  Stream Specific Rules
Lines 32-67:  Basic Rules (Apply to ALL Formats)
Lines 69-193: Section 1: High Level Duels (HLD Format)
Lines 196-246: Section 2: Melee Duels
Lines 247-258: Section 3: Team Duels
Lines 259-357: Section 4: Low Level Dueling (LLD Format)
```

### Section 1 (HLD) - Detailed Structure

```
Lines 69-83:   General HLD Rules
Lines 84-108:  Banned Skills
Lines 109-112: Banned Items
Lines 114-139: Elemental, Absorb, & Resistances
Lines 141-193: Class-Specific Rules
```

**Class-Specific Subsections (HLD):**
- Assassin (lines 143-152)
- Sorceress (lines 154-161)
- Druid (lines 163-166)
- Necromancer (lines 168-173)
- Paladin (lines 175-179, 190-192) - Two entries
- Amazon (lines 181-188)

### Section 4 (LLD) - Detailed Structure

```
Lines 261-267: General Rules
Lines 268-288: Items & Affixes
Lines 289-357: Class Restrictions
```

**Class Restrictions (LLD):**
- 13) Amazon (lines 291-302)
- 14) Assassin (lines 304-307)
- 15) Barbarian (lines 309-313)
- 16) Necromancer (lines 315-325)
- 17) Paladin (lines 327-334)
- 18) Druid (lines 336-343)
- 19) Sorceress (lines 345-356)

Each class has nested subsections:
- Restricted Skills
- Banned Skills
- Banned Items

### Structural Patterns

#### **Pattern 1: Major Section Headers**
```regex
^(\*\*[A-Z][^*]+\*\*|Section \d+:)
```
Matches: `**Stream Specific Rules:**`, `Section 1: High Level Duels`

#### **Pattern 2: Class Names (HLD)**
```regex
^(Amazon|Assassin|Barbarian|Druid|Necromancer|Paladin|Sorceress)$
```

#### **Pattern 3: Class Names (LLD)**
```regex
^\d+\) (Amazon|Assassin|Barbarian|Druid|Necromancer|Paladin|Sorceress)
```

#### **Pattern 4: Numbered Rules**
```regex
^\d+[\.\)]\s+(.+)
```

### Special Cases

1. **Embedded Image (Line 82):**
   ```markdown
   ![][image1]
   [image1]: <data:image/png;base64,iVBORw0K...>
   ```
   Content: Server advantage chart for matchups

2. **Duplicate Class (Paladin):**
   - First entry (line 175): General Paladin rules
   - Second entry (line 190): Paladin vs Amazon specific rule

3. **Nested Exceptions:**
   Rules often have 3-4 levels of nesting for exceptions:
   ```markdown
   9) Replenish Life is capped at 22, with the following EXCEPTIONS:
      1) Sorceresses can not have ANY Rep Life if using Energy Shield
      2) Trap Assassins can not exceed 10...
   ```

4. **Text Formatting:**
   - `*Italic*`: Skill/item names (*Insight*, *Thundergod's Vigor*)
   - `**Bold**`: Section headers, emphasis
   - `ALL CAPS`: Emphasis (MUST, EXCEPTION, OKAY)
   - Escapes: `\-`, `\+` for special characters

### Structural Consistency Rating

| Aspect | Rating | Notes |
|--------|--------|-------|
| Section Headers | ⭐⭐⭐⭐⭐ | Extremely consistent |
| Class Organization | ⭐⭐⭐⭐ | Two formats (HLD vs LLD), both predictable |
| Rule Numbering | ⭐⭐⭐ | Three systems, minor inconsistencies |
| Nested Rules | ⭐⭐⭐⭐ | Clear indentation patterns |
| Overall Parseability | ⭐⭐⭐⭐ | **Highly Suitable for Parsing** |

---

## Command Design

### Command Signature

```
/rules [class] [format]
```

**Parameters:**
- `class` (optional): Choice with autocomplete
  - Options: Amazon, Assassin, Barbarian, Druid, Necromancer, Paladin, Sorceress
- `format` (optional): Choice with autocomplete
  - Options: HLD, LLD, Melee, Team

### Behavior Matrix

| Command | Display |
|---------|---------|
| `/rules` | Navigation menu with buttons |
| `/rules Sorceress` | All format rules for Sorceress (HLD + LLD if applicable) |
| `/rules Sorceress HLD` | HLD-specific rules for Sorceress |
| `/rules HLD` | All HLD rules (general + all classes) |

### Navigation Menu Design

When user invokes `/rules` with no arguments:

```
📜 DFC Official Rules

Select a section to view:

[General Rules] [HLD Rules] [LLD Rules]
[Melee Rules]  [Team Rules] [Class Rules]

Or use: /rules [class] [format] for specific rules
Link to full document: [Google Docs]
```

**Button Interactions:**
- `General Rules` → Shows Stream + Basic rules
- `HLD Rules` → Shows full HLD section (paginated if needed)
- `Class Rules` → Shows dropdown/buttons for class selection
- Each button triggers `handleButton()` method with stored state

### Discord Embed Format

**Single Rule Section:**
```javascript
{
  title: "📜 DFC Rules - Sorceress (HLD)",
  description: "[Rules content here]",
  color: 0x3498db,
  footer: {
    text: "Last updated: [timestamp] | Use /rules for navigation"
  },
  fields: [
    {
      name: "Energy Shield Restrictions",
      value: "• Max Res to Cold, Lightning, and Fire cannot exceed 75%\n• You cannot use any % Absorb\n...",
      inline: false
    }
  ]
}
```

**Pagination (for long content):**
- Split into multiple embeds if content exceeds 2000 characters
- Use buttons: `[◀ Previous] [Page 1/3] [Next ▶]`
- Store page state in button customId

### Response Patterns

1. **Ephemeral Responses:** Use `ephemeral: true` for privacy
2. **Deferred Replies:** Use `interaction.deferReply()` for cache fetches
3. **Edit Reply:** Use `interaction.editReply()` after data fetch
4. **Follow-up Messages:** Use `interaction.followUp()` for pagination

---

## Implementation Components

### 1. Create `utils/rulesCache.js`

**Purpose:** Cache Google Docs rules document in Redis

**Key Methods:**
```javascript
class RulesCache {
  constructor() {
    this.isRefreshing = false;
  }

  async getCachedData() {
    // Try Redis first
    // Fall back to fetchLiveData() if not found
  }

  async fetchLiveData() {
    // Fetch from Google Docs API
    // Parse document structure
    // Return structured JSON
  }

  async refreshCache() {
    // Fetch live data
    // Store in Redis with 604800s TTL
    // Update timestamp
  }

  async getCacheTimestamp() {
    // Return last refresh time
  }

  async isCacheStale() {
    // Check if cache needs refresh
  }
}

module.exports = new RulesCache();
```

**Redis Keys:**
```
dfc-data:rules-document      // Full parsed rules JSON
dfc-data:rules-timestamp     // Last update timestamp
```

**Cache Structure:**
```javascript
{
  sections: {
    stream: { content: "...", lineStart: 13, lineEnd: 30 },
    basic: { content: "...", lineStart: 32, lineEnd: 67 },
    hld: {
      general: { content: "...", lineStart: 69, lineEnd: 83 },
      banned_skills: { content: "...", lineStart: 84, lineEnd: 108 },
      banned_items: { content: "...", lineStart: 109, lineEnd: 112 },
      elemental: { content: "...", lineStart: 114, lineEnd: 139 },
      classes: {
        Assassin: { content: "...", lineStart: 143, lineEnd: 152 },
        Sorceress: { content: "...", lineStart: 154, lineEnd: 161 },
        // ... other classes
      }
    },
    melee: { content: "...", lineStart: 196, lineEnd: 246 },
    team: { content: "...", lineStart: 247, lineEnd: 258 },
    lld: {
      general: { content: "...", lineStart: 261, lineEnd: 267 },
      items: { content: "...", lineStart: 268, lineEnd: 288 },
      classes: {
        Amazon: {
          restricted_skills: [...],
          banned_skills: [...],
          banned_items: [...],
          lineStart: 291,
          lineEnd: 302
        },
        // ... other classes
      }
    }
  },
  images: {
    server_advantage_chart: "data:image/png;base64,..."
  },
  metadata: {
    lastFetched: "2025-11-19T...",
    totalLines: 357,
    documentId: "1YwECuHx-N-24rsC4wUWYonhnWxKmdzKRpAtcPeHJpXE"
  }
}
```

### 2. Create `utils/rulesParser.js`

**Purpose:** Parse Google Docs export or markdown file into structured JSON

**Key Methods:**
```javascript
class RulesParser {
  parseMarkdown(markdownText) {
    // Split into lines
    // Identify major sections
    // Extract class-specific rules
    // Handle nested lists
    // Return structured JSON
  }

  extractSection(lines, startPattern, endPattern) {
    // Extract text between patterns
  }

  extractClasses(sectionLines, format) {
    // HLD: Simple class headers
    // LLD: Numbered class entries
  }

  parseNestedRules(ruleText) {
    // Parse indented nested lists
    // Identify EXCEPTION clauses
  }

  convertToDiscordMarkdown(text) {
    // Convert markdown to Discord-friendly format
    // Handle *italic*, **bold**
    // Format lists properly
  }

  extractImages(markdownText) {
    // Find image references
    // Extract base64 data
    // Return image map
  }
}

module.exports = new RulesParser();
```

**Parsing Algorithm:**
```javascript
function parseRules(markdownText) {
  const lines = markdownText.split('\n');
  const sections = {};

  // Step 1: Identify major sections
  const sectionMarkers = [
    { name: 'stream', start: '**Stream Specific Rules:**', end: '**Basic Rules' },
    { name: 'basic', start: '**Basic Rules', end: '**Section 1:' },
    { name: 'hld', start: 'Section 1: High Level', end: 'Section 2:' },
    { name: 'melee', start: 'Section 2: Melee', end: 'Section 3:' },
    { name: 'team', start: 'Section 3: Team', end: 'Section 4:' },
    { name: 'lld', start: 'Section 4: Low Level', end: null }
  ];

  // Step 2: Extract each section
  sectionMarkers.forEach(marker => {
    sections[marker.name] = extractSection(lines, marker.start, marker.end);
  });

  // Step 3: Parse HLD classes
  sections.hld.classes = extractClasses(sections.hld.content, 'HLD');

  // Step 4: Parse LLD classes
  sections.lld.classes = extractClasses(sections.lld.content, 'LLD');

  // Step 5: Extract images
  sections.images = extractImages(markdownText);

  return sections;
}
```

### 3. Create `commands/rules.js`

**Purpose:** Discord slash command for displaying rules

**Command Definition:**
```javascript
const { SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
  .setName('rules')
  .setDescription('View DFC tournament rules')
  .addStringOption(option =>
    option.setName('class')
      .setDescription('Select a character class')
      .setRequired(false)
      .addChoices(
        { name: 'Amazon', value: 'Amazon' },
        { name: 'Assassin', value: 'Assassin' },
        { name: 'Barbarian', value: 'Barbarian' },
        { name: 'Druid', value: 'Druid' },
        { name: 'Necromancer', value: 'Necromancer' },
        { name: 'Paladin', value: 'Paladin' },
        { name: 'Sorceress', value: 'Sorceress' }
      ))
  .addStringOption(option =>
    option.setName('format')
      .setDescription('Select duel format')
      .setRequired(false)
      .addChoices(
        { name: 'HLD (High Level)', value: 'HLD' },
        { name: 'LLD (Low Level)', value: 'LLD' },
        { name: 'Melee', value: 'Melee' },
        { name: 'Team', value: 'Team' }
      ));
```

**Execute Method:**
```javascript
async execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const classChoice = interaction.options.getString('class');
  const formatChoice = interaction.options.getString('format');

  // Fetch cached rules
  const rules = await rulesCache.getCachedData();

  if (!classChoice && !formatChoice) {
    // Show navigation menu
    return showNavigationMenu(interaction, rules);
  }

  if (classChoice && formatChoice) {
    // Show specific class + format
    return showClassFormatRules(interaction, rules, classChoice, formatChoice);
  }

  if (classChoice) {
    // Show all formats for class
    return showClassAllFormats(interaction, rules, classChoice);
  }

  if (formatChoice) {
    // Show all classes for format
    return showFormatAllClasses(interaction, rules, formatChoice);
  }
}
```

**Button Handler:**
```javascript
async handleButton(interaction) {
  const [action, ...params] = interaction.customId.split('_');

  if (action === 'rules') {
    const [section, classOrFormat] = params;

    // Fetch rules from cache
    const rules = await rulesCache.getCachedData();

    switch (section) {
      case 'nav':
        return showNavigationMenu(interaction, rules);
      case 'general':
        return showGeneralRules(interaction, rules);
      case 'hld':
        return showHLDRules(interaction, rules);
      case 'lld':
        return showLLDRules(interaction, rules);
      case 'melee':
        return showMeleeRules(interaction, rules);
      case 'team':
        return showTeamRules(interaction, rules);
      case 'classes':
        return showClassSelector(interaction, rules);
      case 'class':
        return showClassRules(interaction, rules, classOrFormat);
    }
  }
}
```

**Helper Methods:**
```javascript
function showNavigationMenu(interaction, rules) {
  const embed = {
    title: '📜 DFC Official Rules',
    description: 'Select a section to view detailed rules:',
    color: 0x3498db
  };

  const buttons = [
    { customId: 'rules_general', label: 'General Rules', style: 'PRIMARY' },
    { customId: 'rules_hld', label: 'HLD Rules', style: 'PRIMARY' },
    { customId: 'rules_lld', label: 'LLD Rules', style: 'PRIMARY' },
    { customId: 'rules_melee', label: 'Melee Rules', style: 'SECONDARY' },
    { customId: 'rules_team', label: 'Team Rules', style: 'SECONDARY' },
    { customId: 'rules_classes', label: 'Class Rules', style: 'SUCCESS' }
  ];

  const linkButton = {
    style: 'LINK',
    label: 'View Full Rules (Google Docs)',
    url: 'https://docs.google.com/document/d/1YwECuHx-N-24rsC4wUWYonhnWxKmdzKRpAtcPeHJpXE/edit'
  };

  // Send embed with buttons
  return interaction.editReply({ embeds: [embed], components: [buttons, [linkButton]] });
}

function showClassFormatRules(interaction, rules, className, format) {
  let content;

  if (format === 'HLD') {
    content = rules.sections.hld.classes[className]?.content;
  } else if (format === 'LLD') {
    content = rules.sections.lld.classes[className]?.content;
  }

  if (!content) {
    return interaction.editReply({
      content: `No specific ${format} rules found for ${className}.`,
      ephemeral: true
    });
  }

  // Split content if too long
  const chunks = splitContent(content, 1900);

  const embeds = chunks.map((chunk, i) => ({
    title: i === 0 ? `📜 ${className} Rules (${format})` : null,
    description: chunk,
    color: 0x3498db,
    footer: chunks.length > 1 ? {
      text: `Page ${i + 1}/${chunks.length}`
    } : null
  }));

  return interaction.editReply({ embeds });
}

function splitContent(content, maxLength) {
  // Split content into chunks under maxLength
  // Respect line breaks and list formatting
  const chunks = [];
  let currentChunk = '';

  const lines = content.split('\n');

  for (const line of lines) {
    if ((currentChunk + line).length > maxLength) {
      chunks.push(currentChunk.trim());
      currentChunk = line + '\n';
    } else {
      currentChunk += line + '\n';
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
```

### 4. Update `utils/googleAuth.js`

**Add Google Docs API scope:**

```javascript
function createGoogleAuth(scopes = []) {
  const defaultScopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/documents.readonly'  // ADD THIS
  ];

  // ... rest of auth setup
}
```

### 5. Update Environment Variables

**`.env` additions:**
```env
# Google Docs
RULES_DOC_ID=1YwECuHx-N-24rsC4wUWYonhnWxKmdzKRpAtcPeHJpXE
PROD_RULES_DOC_ID=1YwECuHx-N-24rsC4wUWYonhnWxKmdzKRpAtcPeHJpXE

# Test environment (use same doc for now)
TEST_RULES_DOC_ID=1YwECuHx-N-24rsC4wUWYonhnWxKmdzKRpAtcPeHJpXE
```

### 6. Update `index.js` - Cache Refresh Integration

**Add rulesCache to cron jobs:**

```javascript
const rulesCache = require('./utils/rulesCache');

// Existing cron: Thursday 5:30pm ET (22:30 UTC)
cron.schedule('30 22 * * 4', async () => {
  console.log('Running scheduled cache refresh (Thursday 5:30pm ET)...');
  try {
    await Promise.all([
      duelDataCache.refreshCache(),
      rosterCache.refreshCache(),
      signupsCache.refreshCache(),
      rulesCache.refreshCache()  // ADD THIS
    ]);
    console.log('All caches refreshed successfully');
  } catch (error) {
    console.error('Error refreshing caches:', error);
  }
}, {
  timezone: 'America/New_York'
});

// Repeat for Friday 2:00am ET and Friday 11:00pm ET cron jobs
```

### 7. Update `commands/refreshcache.js`

**Add rulesCache to manual refresh:**

```javascript
const rulesCache = require('../utils/rulesCache');

async execute(interaction) {
  // ... existing code ...

  await interaction.editReply('Refreshing all caches...');

  const beforeTimestamps = {
    duelData: await duelDataCache.getCacheTimestamp(),
    roster: await rosterCache.getCacheTimestamp(),
    signups: await signupsCache.getCacheTimestamp(),
    rules: await rulesCache.getCacheTimestamp()  // ADD THIS
  };

  await Promise.all([
    duelDataCache.refreshCache(),
    rosterCache.refreshCache(),
    signupsCache.refreshCache(),
    rulesCache.refreshCache()  // ADD THIS
  ]);

  const afterTimestamps = {
    duelData: await duelDataCache.getCacheTimestamp(),
    roster: await rosterCache.getCacheTimestamp(),
    signups: await signupsCache.getCacheTimestamp(),
    rules: await rulesCache.getCacheTimestamp()  // ADD THIS
  };

  // ... update embed to show rules cache timestamp ...
}
```

---

## Caching Strategy

### Data Flow

```
Google Docs → Export as Markdown → Parse → Redis Cache → Discord Bot
     ↓                                           ↓
(Manual Update)                          (Auto-refresh 3x/week)
     ↓                                           ↓
Download MD → Save to docs/ → Git commit   Fetch & Cache
```

### Cache Lifecycle

1. **Initial Load:** On bot startup, check if Redis has cached rules
2. **Cache Miss:** Fetch from Google Docs API, parse, store in Redis
3. **Cache Hit:** Return cached data directly
4. **Scheduled Refresh:** Every Thursday 5:30pm, Friday 2am, Friday 11pm ET
5. **Manual Refresh:** Via `/refreshcache` command (Moderator role)
6. **Cache Expiry:** 1 week TTL (604800 seconds)

### Fallback Strategy

```javascript
async getCachedData() {
  try {
    // Try Redis first
    const cached = await redisClient.get('dfc-data:rules-document');
    if (cached) {
      console.log('Rules cache hit');
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error('Redis error, falling back to live fetch:', error);
  }

  // Fallback to live fetch
  console.log('Rules cache miss, fetching from Google Docs...');
  return await this.fetchLiveData();
}
```

### Performance Metrics

| Operation | Redis (Cache Hit) | Google Docs API (Cache Miss) |
|-----------|------------------|------------------------------|
| Fetch Time | <10ms | 500ms - 2s |
| Network Calls | 0 | 1 |
| Parsing Required | No (pre-parsed JSON) | Yes (full parse) |
| Bot Timeout Risk | None | Low (within 3s limit) |

---

## Technical Considerations

### Google Docs API Integration

**API Endpoint:**
```javascript
const { google } = require('googleapis');
const auth = createGoogleAuth();
const docs = google.docs('v1');

const response = await docs.documents.get({
  auth,
  documentId: process.env.RULES_DOC_ID
});

const document = response.data;
```

**Document Structure (JSON):**
```javascript
{
  documentId: "1YwECuHx-N...",
  title: "Official-DFC-Rules",
  body: {
    content: [
      {
        paragraph: {
          elements: [
            { textRun: { content: "Rules for\n", textStyle: {...} } }
          ],
          paragraphStyle: {...}
        }
      },
      // ... more paragraphs
    ]
  }
}
```

**Parsing Challenges:**
1. Google Docs JSON is verbose (nested paragraphs, textRuns)
2. Markdown export is simpler but requires manual download
3. **Recommendation:** Use markdown export approach initially, then enhance with API later

### Alternative: Markdown File Approach

**Simpler Implementation:**

1. **Manual Export:** Download Google Doc as Markdown
2. **Git Commit:** Save to `docs/Official-DFC-Rules.md` (currently gitignored)
3. **Parse from File:** Read from local file instead of API
4. **Cache Parsed Data:** Store structured JSON in Redis

**Pros:**
- Simpler parsing (already markdown)
- No API rate limits
- Faster development

**Cons:**
- Requires manual export step
- Not fully automated
- Git repo size increases slightly

**Hybrid Approach (Recommended):**
- Phase 1: Use markdown file for MVP
- Phase 2: Add Google Docs API integration for auto-sync

### Discord Limitations

1. **Embed Description Limit:** 4096 characters
2. **Field Value Limit:** 1024 characters
3. **Total Embed Size:** 6000 characters
4. **Embeds per Message:** 10

**Strategy:** Split long sections across multiple embeds using pagination.

### Image Handling

**Server Advantage Chart (line 82):**
- **Current:** Base64 embedded in markdown (~30KB)
- **Option 1:** Extract and upload to Discord as attachment
- **Option 2:** Convert to Discord CDN link (via temp message upload)
- **Option 3:** Store base64 in cache, send as buffer when needed

**Recommended:** Extract base64, convert to Buffer, send as Discord attachment:

```javascript
const imageData = Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ''), 'base64');

await interaction.editReply({
  content: 'Server Advantage Chart:',
  files: [{
    attachment: imageData,
    name: 'server-advantage-chart.png'
  }]
});
```

### Error Handling

**Common Errors:**
1. **Google Docs API 403:** Service account lacks permission
   - Solution: Share doc with service account email
2. **Redis Connection Error:** Redis unavailable
   - Solution: Graceful fallback to live fetch
3. **Parse Error:** Document structure changed
   - Solution: Log error, use cached version if available
4. **Discord Timeout:** Fetch takes >3 seconds
   - Solution: Use `deferReply()` before fetch

**Error Response Pattern:**
```javascript
try {
  const rules = await rulesCache.getCachedData();
  // ... process rules
} catch (error) {
  console.error('Error fetching rules:', error);
  return interaction.editReply({
    content: '❌ Error loading rules. Please try again or view the full document: https://docs.google.com/...',
    ephemeral: true
  });
}
```

---

## Testing Plan

### Unit Tests

1. **Parser Tests:**
   - Test section extraction
   - Test class extraction (HLD vs LLD)
   - Test nested rule parsing
   - Test image extraction

2. **Cache Tests:**
   - Test Redis store/retrieve
   - Test TTL expiry
   - Test fallback to live fetch
   - Test concurrent refresh prevention

### Integration Tests

1. **Google Docs API:**
   - Test document fetch
   - Test authentication
   - Test permission errors

2. **Redis:**
   - Test connection
   - Test data persistence
   - Test graceful degradation

### Manual Testing Checklist

**Command Invocations:**
- [ ] `/rules` → Shows navigation menu
- [ ] `/rules Sorceress` → Shows all Sorceress rules
- [ ] `/rules Sorceress HLD` → Shows HLD Sorceress rules
- [ ] `/rules Sorceress LLD` → Shows LLD Sorceress rules
- [ ] `/rules HLD` → Shows all HLD rules
- [ ] `/rules Melee` → Shows Melee rules

**Button Interactions:**
- [ ] Click "General Rules" → Shows stream + basic rules
- [ ] Click "HLD Rules" → Shows full HLD section
- [ ] Click "Class Rules" → Shows class selector
- [ ] Click class button → Shows class-specific rules

**Cache Behavior:**
- [ ] First load after restart → Fetches from source
- [ ] Second load → Uses cached data (<10ms)
- [ ] `/refreshcache` → Updates cache
- [ ] Redis disabled → Falls back to live fetch

**Edge Cases:**
- [ ] Invalid class name → Error message
- [ ] Invalid format → Error message
- [ ] Long content → Pagination works
- [ ] Image display → Renders correctly

### Test Environments

1. **Test Server (TEST_MODE=true):**
   - Use `TEST_RULES_DOC_ID`
   - Test Redis connection
   - Test command deployment

2. **Production Server (TEST_MODE=false):**
   - Use `PROD_RULES_DOC_ID`
   - Verify cache refresh schedule
   - Monitor performance

---

## Implementation Phases

### Phase 1: Core Infrastructure (MVP)
**Goal:** Basic command with markdown file parsing

1. Create `utils/rulesParser.js` - Parse local markdown file
2. Create `utils/rulesCache.js` - Redis caching layer
3. Create `commands/rules.js` - Basic command (class + format params)
4. Update `index.js` - Add to cache refresh cron
5. Update `refreshcache.js` - Add rules to manual refresh
6. Test with local `docs/Official-DFC-Rules.md`

**Deliverables:**
- Working `/rules [class] [format]` command
- Cached rules data in Redis
- Basic embed display

### Phase 2: Navigation & UX
**Goal:** Enhanced user experience

1. Add navigation menu to `/rules`
2. Implement button handlers
3. Add pagination for long content
4. Add image attachment support
5. Polish embed formatting
6. Add error handling

**Deliverables:**
- Interactive navigation menu
- Button-driven browsing
- Paginated long sections
- User-friendly error messages

### Phase 3: Google Docs Integration (Optional)
**Goal:** Automated sync from source

1. Update `googleAuth.js` - Add Docs API scope
2. Update `rulesCache.js` - Add Google Docs fetch method
3. Implement document-to-markdown converter
4. Add environment variables for doc IDs
5. Test auto-sync from Google Docs

**Deliverables:**
- Automated sync from Google Docs
- No manual export needed
- Real-time rule updates

---

## Future Enhancements

1. **Search Functionality:** `/rules search [keyword]`
2. **Rule Change Notifications:** Announce updates in Discord channel
3. **Version History:** Track rule changes over time
4. **Comparison View:** Show differences between HLD/LLD for same class
5. **Admin Commands:** `/rules update` to trigger immediate cache refresh
6. **Mobile Optimization:** Better formatting for mobile Discord clients
7. **Bookmarks:** Users can save frequently referenced rules
8. **Quick Reference:** Condensed view of most common rules

---

## Success Metrics

- **Performance:** <100ms response time for cached queries
- **Reliability:** 99.9% uptime, graceful fallback on failures
- **Usage:** Track command invocations, popular classes/formats
- **Accuracy:** Rules match source document exactly
- **Freshness:** Cache updates within 5 minutes of scheduled refresh

---

## Appendix

### File Structure

```
commands/
  └── rules.js              // Main command file

utils/
  ├── rulesCache.js         // Redis caching layer
  ├── rulesParser.js        // Markdown parser
  └── googleAuth.js         // Updated with Docs API scope

docs/
  ├── Official-DFC-Rules.md // Source document (gitignored)
  └── rules-command-implementation-plan.md // This file

.env                        // Add RULES_DOC_ID variables
index.js                    // Add rulesCache to cron jobs
```

### Environment Variables Reference

```env
# Google Docs (add these)
RULES_DOC_ID=1YwECuHx-N-24rsC4wUWYonhnWxKmdzKRpAtcPeHJpXE
PROD_RULES_DOC_ID=1YwECuHx-N-24rsC4wUWYonhnWxKmdzKRpAtcPeHJpXE
TEST_RULES_DOC_ID=1YwECuHx-N-24rsC4wUWYonhnWxKmdzKRpAtcPeHJpXE

# Existing (no changes needed)
BOT_TOKEN=...
CLIENT_ID=...
GOOGLE_CLIENT_EMAIL=...
GOOGLE_PRIVATE_KEY=...
REDISCLOUD_URL=...
```

### Redis Keys Reference

```
dfc-data:rules-document      // Parsed rules JSON (expires in 604800s)
dfc-data:rules-timestamp     // Last refresh timestamp
```

### Useful Regex Patterns

```javascript
// Major sections
const SECTION_PATTERN = /^(\*\*[A-Z][^*]+\*\*|Section \d+:)/;

// Class names (HLD)
const CLASS_HLD_PATTERN = /^(Amazon|Assassin|Barbarian|Druid|Necromancer|Paladin|Sorceress)$/;

// Class names (LLD)
const CLASS_LLD_PATTERN = /^\d+\) (Amazon|Assassin|Barbarian|Druid|Necromancer|Paladin|Sorceress)/;

// Numbered rules
const RULE_PATTERN = /^\d+[\.\)]\s+(.+)/;

// Exception clauses
const EXCEPTION_PATTERN = /EXCEPTION:|No more than|MUST|CANNOT|may not|are (banned|allowed)/i;

// Image references
const IMAGE_PATTERN = /!\[\]\[(\w+)\]/;
const IMAGE_DEF_PATTERN = /\[(\w+)\]:\s*<data:image\/(\w+);base64,([^>]+)>/;
```

---

**Document Version:** 1.0
**Last Updated:** 2025-11-19
**Author:** DFC-Data Bot Development Team
**Status:** Ready for Implementation
