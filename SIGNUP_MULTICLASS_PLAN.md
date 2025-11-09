# Multi-Class Signup Command Implementation Plan

## Overview
This document outlines the transformation of the `/signup` command from single-class selection to multi-class selection per division, enabling users to sign up for multiple classes in a single command invocation.

## Background & Context

### Current Implementation (Single-Class)
- User runs `/signup`
- Selects ONE division (HLD, LLD, Melee, Teams)
- Selects ONE class (Amazon, Assassin, Barbarian, Druid, Necromancer, Paladin, Sorceress)
- Enters build type and optional notes in modal
- Submits ONE Google Form entry
- **To sign up multiple classes:** User must run `/signup` multiple times

### Problem Statement
Users find it tedious to run `/signup` multiple times when they want to participate with multiple classes in the same division. The Google Form already supports multi-class selection via checkboxes, but the Discord bot doesn't match this functionality.

### Design Decision (from Discord conversation with Coooley)
> "multiple classes per division is OKAY but we probably want one division per sign up"

This means:
- ✅ **Allow multiple classes in single signup** (e.g., Druid + Necro + Barb for HLD)
- ✅ **Keep single division per invocation** (user runs `/signup` again for LLD, Melee, etc.)
- ✅ **Single form submission** (not one per class)
- ✅ **Parse class/build details in notes field** to avoid confusion in Card Creation

## New Implementation Design

### User Flow

#### Step 1: Division Selection
- User runs `/signup`
- Bot checks registration window (Friday 12am - Tuesday 11pm ET)
- Display 4 buttons: HLD, LLD, Melee, Teams
- User clicks ONE button
- **No change from current implementation**

#### Step 2: Class Multi-Select (NEW)
- Display 7 class buttons with custom emojis
- **Toggle pattern** (click to select/deselect)
- Visual feedback:
  - Selected: `ButtonStyle.Success` (green)
  - Unselected: `ButtonStyle.Secondary` (gray)
- Show current selections in embed description
- "Continue" button to proceed (requires at least 1 class selected)
- Store selections in Redis session

#### Step 3: Warning for 5+ Classes (NEW - Optional)
- If user selected 5-7 classes, show warning:
  - "⚠️ You selected {count} classes. You'll need to complete 2 forms to enter builds. Continue or go back to reduce selections?"
  - [Continue] [Go Back] buttons
- Gives users option to optimize their experience

#### Step 4: Build Entry Modal(s)
**Case A: 1-4 Classes Selected** (Single Modal)
```
Title: "HLD Signup - Enter Builds"
Fields:
  1. Amazon Build (required, 100 chars)
  2. Necromancer Build (required, 100 chars)
  3. Paladin Build (required, 100 chars)
  4. Notes (optional, 500 chars)
```

**Case B: 5-7 Classes Selected** (Two Modals)
```
Modal 1:
Title: "HLD Signup - Enter Builds (1 of 2)"
Fields:
  1. Amazon Build (required, 100 chars)
  2. Necromancer Build (required, 100 chars)
  3. Paladin Build (required, 100 chars)
  4. Druid Build (required, 100 chars)

Modal 2:
Title: "HLD Signup - Enter Builds (2 of 2)"
Fields:
  1. Assassin Build (required, 100 chars)
  2. Barbarian Build (required, 100 chars)
  3. Sorceress Build (required, 100 chars)
  4. Notes (optional, 500 chars)
```

**Discord Limitation:** Modals have a hard limit of 5 text input fields. We use 4 for builds in modal 1 to leave room for notes in the final modal.

#### Step 5: Submission
- Construct formatted strings from collected data
- Submit ONE Google Form entry
- Display success confirmation with summary

### Google Form Submission Format

#### Current Format (Single Class)
```
Discord Handle: "PlayerName"
Division: "Unlimited (HLD)"
Class: "Druid"
Build Type / Notes: "Wind - some notes here"
```

#### New Format (Multiple Classes)
```
Discord Handle: "PlayerName"
Division: "Unlimited (HLD)"
Class: "Amazon, Necromancer, Paladin"
Build Type / Notes: "Amazon - Java, Necro - Bone, Pala - Hammerdin / These are my notes"
```

#### String Construction Logic

**Class Field (Column D):**
```javascript
const classString = selectedClasses.join(', ');
// Examples:
// "Druid"
// "Amazon, Necromancer, Paladin"
// "Paladin, Assassin, Druid, Barbarian"
```

**Build Type / Notes Field (Column E):**
```javascript
const buildPairs = selectedClasses.map(cls => `${cls} - ${builds[cls]}`);
const buildString = buildPairs.join(', ');
const finalBuildString = notes ? `${buildString} / ${notes}` : buildString;

// Examples:
// Single class with notes: "Druid - Wind / Testing new build"
// Multiple classes no notes: "Amazon - Java, Necro - Bone, Pala - Hammerdin"
// Multiple classes with notes: "Amazon - Java, Necro - Bone, Pala - Hammerdin / These are my notes"
```

## Technical Implementation

### Architecture Changes

#### Redis State Management (NEW)
Current signup command is **stateless** (all state encoded in customId strings). This won't work for multi-select due to Discord's 100-character customId limit.

**Solution:** Add Redis session storage (pattern from `reportwin.js`)

**State Structure:**
```javascript
{
  userId: "123456789",
  division: "HLD",
  selectedClasses: ["Amazon", "Necromancer", "Paladin"],
  builds: {
    "Amazon": "Java",
    "Necromancer": "Bone",
    "Paladin": "Hammerdin"
  },
  notes: "These are my notes",
  timestamp: 1699564800000
}
```

**TTL:** 10 minutes (same as reportwin.js)

#### New File: `utils/signupCache.js`
```javascript
const redisClient = require('./redisClient');

const SIGNUP_PREFIX = 'signup_';
const SIGNUP_TTL = 600; // 10 minutes

async function getSignupData(userId) {
  const key = `${SIGNUP_PREFIX}${userId}`;
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
}

async function setSignupData(userId, data) {
  const key = `${SIGNUP_PREFIX}${userId}`;
  await redisClient.set(key, JSON.stringify(data), { EX: SIGNUP_TTL });
}

async function clearSignupData(userId) {
  const key = `${SIGNUP_PREFIX}${userId}`;
  await redisClient.del(key);
}

module.exports = {
  getSignupData,
  setSignupData,
  clearSignupData
};
```

### File Modifications: `commands/signup.js`

#### Section 1: Class Selection Handler (Lines ~128-188)
**Current:** Single-select buttons → Show modal immediately

**New:** Multi-select toggle buttons → Store in Redis → Show continue button

**Pattern Reference:** `reportwin.js:577-647` (mirror type multi-select)

**Key Changes:**
```javascript
// Button handler for class selection
if (interaction.customId.startsWith('signupclass_')) {
  const parts = interaction.customId.split('_');
  const division = parts[1];
  const clickedClass = parts[2];

  // Get or initialize session data
  let data = await getSignupData(interaction.user.id);
  if (!data) {
    data = {
      userId: interaction.user.id,
      division: division,
      selectedClasses: [],
      builds: {},
      notes: ''
    };
  }

  // Toggle class selection
  const index = data.selectedClasses.indexOf(clickedClass);
  if (index > -1) {
    data.selectedClasses.splice(index, 1);
  } else {
    data.selectedClasses.push(clickedClass);
  }

  // Save to Redis
  await setSignupData(interaction.user.id, data);

  // Update button row with visual feedback
  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`signupclass_${division}_Amazon`)
        .setLabel('Amazon')
        .setEmoji(classEmojis.Amazon)
        .setStyle(data.selectedClasses.includes('Amazon')
          ? ButtonStyle.Success
          : ButtonStyle.Secondary),
      // ... repeat for other classes with toggle logic
    );

  const row3 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`signupcontinue_${division}`)
        .setLabel('Continue')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(data.selectedClasses.length === 0)
    );

  // Update embed to show current selections
  const embed = new EmbedBuilder()
    .setTitle('Select Classes for ' + division)
    .setDescription(`Selected: ${data.selectedClasses.join(', ') || 'None'}`);

  await interaction.update({ embeds: [embed], components: [row1, row2, row3] });
}
```

#### Section 2: Continue Button Handler (NEW)
```javascript
if (interaction.customId.startsWith('signupcontinue_')) {
  const division = interaction.customId.split('_')[1];
  const data = await getSignupData(interaction.user.id);

  if (!data || data.selectedClasses.length === 0) {
    return interaction.reply({
      content: 'No classes selected. Please select at least one class.',
      ephemeral: true
    });
  }

  // Check if warning needed (5+ classes)
  if (data.selectedClasses.length >= 5) {
    // Show warning screen
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Multiple Forms Required')
      .setDescription(`You selected ${data.selectedClasses.length} classes. You'll need to complete 2 forms to enter all build details.`)
      .setColor('#FFA500');

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`signupproceed_${division}`)
          .setLabel('Continue Anyway')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`signupback_${division}`)
          .setLabel('Go Back')
          .setStyle(ButtonStyle.Secondary)
      );

    return interaction.update({ embeds: [embed], components: [row] });
  }

  // 1-4 classes: Show modal directly
  await showBuildModal(interaction, data, 1);
}
```

#### Section 3: Dynamic Modal Generation (NEW)
```javascript
async function showBuildModal(interaction, data, modalNumber) {
  const classesPerModal = 4;
  const startIdx = (modalNumber - 1) * classesPerModal;
  const endIdx = Math.min(startIdx + classesPerModal, data.selectedClasses.length);
  const classesInThisModal = data.selectedClasses.slice(startIdx, endIdx);
  const totalModals = Math.ceil(data.selectedClasses.length / classesPerModal);

  const modal = new ModalBuilder()
    .setCustomId(`signupmodal_${modalNumber}`)
    .setTitle(`${data.division} Signup - Builds ${modalNumber > 1 ? `(${modalNumber} of ${totalModals})` : ''}`);

  // Add build fields for classes in this modal
  for (const className of classesInThisModal) {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(`build_${className}`)
          .setLabel(`${className} Build`)
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(true)
          .setPlaceholder(`Enter ${className} build type`)
      )
    );
  }

  // Add notes field only in final modal
  const isLastModal = endIdx === data.selectedClasses.length;
  if (isLastModal) {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('notes')
          .setLabel('Notes (Optional)')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(500)
          .setRequired(false)
          .setPlaceholder('Any additional notes about your signups')
      )
    );
  }

  await interaction.showModal(modal);
}
```

#### Section 4: Modal Submission Handler (Refactored)
```javascript
if (interaction.customId.startsWith('signupmodal_')) {
  const modalNumber = parseInt(interaction.customId.split('_')[1]);
  const data = await getSignupData(interaction.user.id);

  if (!data) {
    return interaction.reply({
      content: 'Session expired. Please run /signup again.',
      ephemeral: true
    });
  }

  // Extract build values from modal
  const classesPerModal = 4;
  const startIdx = (modalNumber - 1) * classesPerModal;
  const endIdx = Math.min(startIdx + classesPerModal, data.selectedClasses.length);
  const classesInThisModal = data.selectedClasses.slice(startIdx, endIdx);

  for (const className of classesInThisModal) {
    const buildValue = interaction.fields.getTextInputValue(`build_${className}`);
    data.builds[className] = buildValue;
  }

  // Check if this is the last modal
  const isLastModal = endIdx === data.selectedClasses.length;

  if (isLastModal) {
    // Extract notes if present
    try {
      data.notes = interaction.fields.getTextInputValue('notes') || '';
    } catch {
      data.notes = '';
    }

    // All builds collected - submit to Google Form
    await submitSignup(interaction, data);
    await clearSignupData(interaction.user.id);
  } else {
    // Save progress and show next modal
    await setSignupData(interaction.user.id, data);
    await interaction.deferUpdate();

    // Show next modal
    await showBuildModal(interaction, data, modalNumber + 1);
  }
}
```

#### Section 5: Form Submission (Refactored)
```javascript
async function submitSignup(interaction, data) {
  // Construct class string: "Amazon, Necromancer, Paladin"
  const classString = data.selectedClasses.join(', ');

  // Construct build string: "Amazon - Java, Necro - Bone, Pala - Hammerdin / notes"
  const buildPairs = data.selectedClasses.map(cls => `${cls} - ${data.builds[cls]}`);
  const buildString = buildPairs.join(', ');
  const finalBuildString = data.notes ? `${buildString} / ${data.notes}` : buildString;

  // Map division to Google Form format
  const divisionMap = {
    'HLD': 'Unlimited (HLD)',
    'LLD': 'Low Level Dueling (LLD)',
    'MELEE': 'Melee',
    'TEAMS': 'Teams'
  };

  // Form submission
  const formData = new URLSearchParams();
  formData.append('entry.2092238618', interaction.user.username); // Discord Handle
  formData.append('entry.1556369182', divisionMap[data.division]); // Division
  formData.append('entry.479301265', classString); // Class
  formData.append('entry.2132117571', finalBuildString); // Build Type / Notes

  const formUrl = TEST_MODE ? process.env.TEST_FORM_ID : process.env.PROD_FORM_ID;

  try {
    const response = await fetch(formUrl, {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (response.ok) {
      const embed = new EmbedBuilder()
        .setTitle('✅ Signup Successful!')
        .setDescription(`You've signed up for **${data.division}** with:\n${data.selectedClasses.map(cls => `• ${cls} - ${data.builds[cls]}`).join('\n')}${data.notes ? `\n\n**Notes:** ${data.notes}` : ''}`)
        .setColor('#00FF00');

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else {
      throw new Error('Form submission failed');
    }
  } catch (error) {
    console.error('Error submitting signup:', error);
    await interaction.reply({
      content: '❌ Error submitting signup. Please try again or contact a moderator.',
      ephemeral: true
    });
  }
}
```

## Implementation Phases

### Phase 1: Infrastructure (1-2 hours)
- Create `utils/signupCache.js`
- Add Redis helper functions
- Test Redis connection and TTL

### Phase 2: Class Multi-Select UI (2-3 hours)
- Convert class buttons to toggle pattern
- Add visual feedback (Success/Secondary styles)
- Implement "Continue" button
- Store selections in Redis
- Test toggle behavior

### Phase 3: Dynamic Modal System (2-3 hours)
- Implement `showBuildModal()` function
- Handle 1-4 classes (single modal)
- Handle 5-7 classes (two modals)
- Test modal field generation

### Phase 4: Warning UI (30 minutes)
- Add warning screen for 5+ classes
- Implement "Continue Anyway" / "Go Back" buttons

### Phase 5: Submission Logic (1 hour)
- Refactor `submitSignup()` function
- Implement string construction (class list, build pairs)
- Test form submission

### Phase 6: Testing (1 hour)
- Test 1 class scenario
- Test 4 classes (edge of single modal)
- Test 5 classes (first multi-modal scenario)
- Test 7 classes (maximum)
- Test session expiration
- Test registration window validation

## Testing Scenarios

### Test Case 1: Single Class
1. Run `/signup`
2. Select HLD
3. Toggle Druid only
4. Click Continue
5. Enter build: "Wind"
6. Enter notes: "Testing single class"
7. Verify form submission:
   - Class: "Druid"
   - Build: "Druid - Wind / Testing single class"

### Test Case 2: Four Classes (Single Modal)
1. Run `/signup`
2. Select LLD
3. Toggle Amazon, Necro, Paladin, Druid
4. Click Continue (no warning)
5. Single modal with 4 build fields + notes
6. Verify form submission:
   - Class: "Amazon, Necromancer, Paladin, Druid"
   - Build: "Amazon - Java, Necro - Bone, Pala - Hammerdin, Druid - Fury / Notes here"

### Test Case 3: Seven Classes (Two Modals)
1. Run `/signup`
2. Select HLD
3. Toggle all 7 classes
4. Click Continue
5. See warning: "You selected 7 classes. You'll need 2 forms."
6. Click "Continue Anyway"
7. Modal 1: Enter builds for Amazon, Necro, Paladin, Druid
8. Modal 2: Enter builds for Assassin, Barb, Sorc + notes
9. Verify form submission:
   - Class: "Amazon, Necromancer, Paladin, Druid, Assassin, Barbarian, Sorceress"
   - Build: "Amazon - X, Necro - Y, Pala - Z, Druid - A, Assassin - B, Barb - C, Sorc - D / Notes"

### Test Case 4: Session Expiration
1. Run `/signup`
2. Select division and classes
3. Wait 11 minutes (TTL expired)
4. Try to submit modal
5. Verify error: "Session expired. Please run /signup again."

### Test Case 5: Registration Window
1. Run `/signup` outside Friday 12am - Tuesday 11pm ET
2. Verify error about registration window

## Edge Cases & Error Handling

### Redis Connection Failure
- Current signup is stateless - consider fallback
- **Recommendation:** Fail gracefully with error message
- No fallback to stateless for multi-select (too complex)

### Session Timeout Mid-Flow
- User gets to modal 2, but session expired
- Show clear error: "Session expired. Please run /signup again."
- TTL of 10 minutes should be sufficient for normal flow

### No Classes Selected
- Disable "Continue" button when `selectedClasses.length === 0`
- Show "None" in embed description

### Form Submission Failure
- Catch fetch errors
- Show user-friendly error message
- Log to console for debugging

## Rollout Plan

### Step 1: Test Environment Validation
1. Deploy to test server (TEST_MODE=true)
2. Run all test scenarios
3. Verify Google Form submissions in test sheet
4. Validate class + build string formatting

### Step 2: Code Review
1. Review with stakeholders
2. Get approval from Coooley
3. Address any feedback

### Step 3: Production Deployment
1. Deploy to Heroku (production environment)
2. Run `node deploy-commands.js` to update commands
3. Monitor first signups for issues

### Step 4: User Communication
1. Announce new multi-class signup feature in Discord
2. Provide example usage
3. Monitor for user confusion or bugs

## Success Metrics

- ✅ Users can select 1-7 classes in single signup
- ✅ Form submissions have correct format
- ✅ Google Sheets data matches expectations
- ✅ No increase in error rates
- ✅ Positive user feedback on streamlined flow

## Estimated Timeline

- **Total Development:** 6-9 hours
- **Testing:** 1-2 hours
- **Deployment & Monitoring:** 1 hour
- **Total:** 8-12 hours

## Questions & Decisions Log

### Q1: Multiple divisions per signup?
**Decision:** No - keep one division per signup to avoid confusion in Card Creation (per Coooley's feedback)

### Q2: Notes per class or shared?
**Decision:** Shared notes field for entire signup (simpler UX)

### Q3: Form submission strategy?
**Decision:** Single form submission with formatted strings (not one per class)

### Q4: Class field format?
**Decision:** Comma + space separated: "Amazon, Necromancer, Paladin"

### Q5: Build field format?
**Decision:** Class-build pairs with slash-separated notes: "Amazon - Java, Necro - Bone / Notes"

### Q6: Handle 5+ classes?
**Decision:** Option 3 - Allow all 7 classes, show warning at 5+, use 2 modals when needed

## References

- Current signup implementation: `commands/signup.js`
- Multi-select pattern: `commands/reportwin.js:577-647`
- Redis helpers: `utils/duelDataCache.js`, `utils/rosterCache.js`
- Google Form entry IDs: Lines 121-134 in current signup.js
- Discord conversation screenshot: `debug-ss/Screenshot 2025-11-09 134435.png`

---

**Document Version:** 1.0
**Last Updated:** 2025-11-09
**Author:** Claude (via conversation with user)
**Status:** Ready for Implementation
