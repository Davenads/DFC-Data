/**
 * Centralized emoji configuration for DFC bot
 *
 * This module contains all custom Discord emoji definitions used across commands.
 * When migrating servers or updating emojis, only update them here.
 */

// Custom class emojis from production Discord server
const classEmojis = {
    Amazon: '<:Amazon:953116506726744094>',
    Assassin: '<:Assassin:953116506697379891>',
    Barbarian: '<:Barb:953116506986782770>',
    Druid: '<:Druid:953116506839973928>',
    Necromancer: '<:Necro:953116507058085918>',
    Paladin: '<:Paladin:953116506928074762>',
    Sorceress: '<:Sorceress:953116506873552997>'
};

// Extract emoji IDs for button usage (used in interactive components)
const classEmojiIds = {
    Amazon: '953116506726744094',
    Assassin: '953116506697379891',
    Barbarian: '953116506986782770',
    Druid: '953116506839973928',
    Necromancer: '953116507058085918',
    Paladin: '953116506928074762',
    Sorceress: '953116506873552997'
};

// Match type emojis
const matchTypeEmojis = {
    HLD: '<:HLD:1434535063755952320>',
    LLD: '<:LLD:1434535487481319598>',
    MELEE: '<:Melee:1434536096238141501>',
    TEAMS: '👥' // Using generic emoji until custom emoji is available
};

// Deckard Cain emoji (used for rankings/info displays)
const deckardCainEmoji = '<:DeckardCain:953116506542182451>';

// Legacy fallback emojis for commands that may need unicode emojis
// These are used when custom Discord emojis aren't available or for external display
const unicodeClassEmojis = {
    amazon: '🏹',
    assassin: '🥷',
    barbarian: '⚔️',
    druid: '🐺',
    necromancer: '💀',
    paladin: '🛡️',
    sorceress: '🔮'
};

/**
 * Get class emoji by class name (case-insensitive)
 * @param {string} className - The class name (e.g., 'Amazon', 'amazon')
 * @param {boolean} useUnicode - If true, returns unicode emoji instead of custom Discord emoji
 * @returns {string} The emoji string
 */
function getClassEmoji(className, useUnicode = false) {
    if (useUnicode) {
        return unicodeClassEmojis[className.toLowerCase()] || '👤';
    }

    // Capitalize first letter for custom emoji lookup
    const capitalizedClass = className.charAt(0).toUpperCase() + className.slice(1).toLowerCase();
    return classEmojis[capitalizedClass] || '👤';
}

/**
 * Get match type emoji
 * @param {string} matchType - The match type (e.g., 'HLD', 'LLD', 'MELEE')
 * @returns {string} The emoji string
 */
function getMatchTypeEmoji(matchType) {
    return matchTypeEmojis[matchType.toUpperCase()] || '';
}

module.exports = {
    classEmojis,
    classEmojiIds,
    matchTypeEmojis,
    unicodeClassEmojis,
    deckardCainEmoji,
    getClassEmoji,
    getMatchTypeEmoji
};
