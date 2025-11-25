const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const rulesCache = require('../utils/rulesCache');
const rulesParser = require('../utils/rulesParser');
const { getClassEmoji } = require('../utils/emojis');

const RULES_DOC_URL = 'https://docs.google.com/document/d/1YwECuHx-N-24rsC4wUWYonhnWxKmdzKRpAtcPeHJpXE/edit';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('View DFC tournament rules')
    .addStringOption(option =>
      option.setName('format')
        .setDescription('Select duel format')
        .setRequired(false)
        .addChoices(
          { name: 'HLD (High Level)', value: 'HLD' },
          { name: 'LLD (Low Level)', value: 'LLD' },
          { name: 'Melee', value: 'Melee' },
          { name: 'Team', value: 'Team' }
        ))
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
        )),

  async execute(interaction) {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const user = interaction.user;
    const classChoice = interaction.options.getString('class');
    const formatChoice = interaction.options.getString('format');

    console.log(`[${timestamp}] [RULES] User: ${user.tag}, Class: ${classChoice || 'none'}, Format: ${formatChoice || 'none'}`);

    try {
      // Defer reply since fetching/parsing may take time
      await interaction.deferReply({ flags: 64 }); // 64 = EPHEMERAL flag

      // Fetch rules from cache
      const fetchStart = Date.now();
      const rules = await rulesCache.getCachedData();
      console.log(`[${timestamp}] [RULES] Rules fetched in ${Date.now() - fetchStart}ms`);

      // No filters - show general information and link
      if (!classChoice && !formatChoice) {
        const embed = new EmbedBuilder()
          .setTitle('📜 DFC Official Rules')
          .setDescription(
            `**Welcome to the DFC Rules!**\n\n` +
            `Use the options below to view specific rules:\n` +
            `• \`/rules format:[format]\` - View all rules for a format (HLD, LLD, Melee, Team)\n` +
            `• \`/rules class:[class]\` - View all rules for a specific class\n` +
            `• \`/rules format:[format] class:[class]\` - View specific class rules for a format\n\n` +
            `**Quick Links:**\n` +
            `[📄 View Full Rules Document](${RULES_DOC_URL})\n\n` +
            `**General Rule Categories:**\n` +
            `• Stream Specific Rules\n` +
            `• Basic Rules (Apply to ALL Formats)\n` +
            `• Section 1: High Level Duels (HLD)\n` +
            `• Section 2: Melee Duels\n` +
            `• Section 3: Team Duels\n` +
            `• Section 4: Low Level Dueling (LLD)`
          )
          .setColor(0x3498db)
          .setFooter({ text: `Last updated: ${new Date(rules.metadata?.lastFetched || Date.now()).toLocaleString()}` });

        await interaction.editReply({ embeds: [embed] });
        console.log(`[${timestamp}] [RULES] Completed in ${Date.now() - startTime}ms - general info`);
        return;
      }

      // Class and Format specified
      if (classChoice && formatChoice) {
        await this.showClassFormatRules(interaction, rules, classChoice, formatChoice, timestamp, startTime);
        return;
      }

      // Only class specified - show both HLD and LLD rules
      if (classChoice) {
        await this.showClassAllFormats(interaction, rules, classChoice, timestamp, startTime);
        return;
      }

      // Only format specified - show all rules for that format
      if (formatChoice) {
        await this.showFormatRules(interaction, rules, formatChoice, timestamp, startTime);
        return;
      }

    } catch (error) {
      console.error(`[${timestamp}] [RULES] Error:`, error);

      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Error Loading Rules')
        .setDescription(
          `An error occurred while loading the rules. Please try again or view the full document:\n\n` +
          `[📄 View Full Rules Document](${RULES_DOC_URL})`
        )
        .setColor(0xe74c3c);

      try {
        await interaction.editReply({ embeds: [errorEmbed] });
      } catch (replyError) {
        console.error(`[${timestamp}] [RULES] Error sending error message:`, replyError);
      }
    }
  },

  /**
   * Show rules for a specific class and format
   */
  async showClassFormatRules(interaction, rules, className, format, timestamp, startTime) {
    let rulesContent = null;

    if (format === 'HLD') {
      rulesContent = rules.hld.classes[className];
    } else if (format === 'LLD') {
      rulesContent = rules.lld.classes[className];
    } else if (format === 'Melee' || format === 'Team') {
      // Melee and Team don't have class-specific rules
      const embed = new EmbedBuilder()
        .setTitle(`📜 ${format} Rules`)
        .setDescription(
          `${format} rules don't have class-specific sections. Use \`/rules ${format}\` to view general ${format} rules.\n\n` +
          `[📄 View Full Rules Document](${RULES_DOC_URL})`
        )
        .setColor(0xf39c12);

      await interaction.editReply({ embeds: [embed] });
      console.log(`[${timestamp}] [RULES] Completed in ${Date.now() - startTime}ms - ${format} has no class rules`);
      return;
    }

    if (!rulesContent || !rulesContent.content) {
      const embed = new EmbedBuilder()
        .setTitle(`📜 ${className} Rules (${format})`)
        .setDescription(
          `No specific ${format} rules found for ${className}.\n\n` +
          `[📄 View Full Rules Document](${RULES_DOC_URL})`
        )
        .setColor(0xf39c12);

      await interaction.editReply({ embeds: [embed] });
      console.log(`[${timestamp}] [RULES] Completed in ${Date.now() - startTime}ms - no rules found`);
      return;
    }

    // Format class rules with proper numbering and hierarchy
    const formattedContent = rulesParser.formatClassRules(rulesContent.content);
    // Convert to Discord-friendly markdown
    const content = rulesParser.convertToDiscordMarkdown(formattedContent);
    const chunks = rulesParser.splitContent(content, 4000); // Discord embed description limit

    // Create embeds for each chunk
    const embeds = chunks.map((chunk, i) => {
      const embed = new EmbedBuilder()
        .setDescription(chunk)
        .setColor(0x3498db);

      if (i === 0) {
        const classEmoji = getClassEmoji(className);
        embed.setTitle(`${classEmoji} ${className} Rules - ${format}`);
      }

      if (i === chunks.length - 1) {
        embed.setFooter({ text: `Lines ${rulesContent.lineStart}-${rulesContent.lineEnd} | /rules for more options` });
      }

      return embed;
    });

    // Discord allows up to 10 embeds per message
    const embedsToSend = embeds.slice(0, 10);

    await interaction.editReply({ embeds: embedsToSend });
    console.log(`[${timestamp}] [RULES] Completed in ${Date.now() - startTime}ms - ${className} ${format} (${chunks.length} chunks)`);
  },

  /**
   * Show all format rules for a specific class
   */
  async showClassAllFormats(interaction, rules, className, timestamp, startTime) {
    const hldRules = rules.hld.classes[className];
    const lldRules = rules.lld.classes[className];

    const embeds = [];

    // HLD Rules
    if (hldRules && hldRules.content) {
      const formattedHld = rulesParser.formatClassRules(hldRules.content);
      const hldContent = rulesParser.convertToDiscordMarkdown(formattedHld);
      const hldChunks = rulesParser.splitContent(hldContent, 4000);

      hldChunks.forEach((chunk, i) => {
        const embed = new EmbedBuilder()
          .setDescription(chunk)
          .setColor(0x3498db);

        if (i === 0) {
          const classEmoji = getClassEmoji(className);
          embed.setTitle(`${classEmoji} ${className} Rules - HLD`);
        }

        if (i === hldChunks.length - 1) {
          embed.setFooter({ text: `HLD Lines ${hldRules.lineStart}-${hldRules.lineEnd}` });
        }

        embeds.push(embed);
      });
    }

    // LLD Rules
    if (lldRules && lldRules.content) {
      const formattedLld = rulesParser.formatClassRules(lldRules.content);
      const lldContent = rulesParser.convertToDiscordMarkdown(formattedLld);
      const lldChunks = rulesParser.splitContent(lldContent, 4000);

      lldChunks.forEach((chunk, i) => {
        const embed = new EmbedBuilder()
          .setDescription(chunk)
          .setColor(0x9b59b6);

        if (i === 0) {
          const classEmoji = getClassEmoji(className);
          embed.setTitle(`${classEmoji} ${className} Rules - LLD`);
        }

        if (i === lldChunks.length - 1) {
          embed.setFooter({ text: `LLD Lines ${lldRules.lineStart}-${lldRules.lineEnd} | /rules for more options` });
        }

        embeds.push(embed);
      });
    }

    if (embeds.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle(`📜 ${className} Rules`)
        .setDescription(
          `No class-specific rules found for ${className}.\n\n` +
          `[📄 View Full Rules Document](${RULES_DOC_URL})`
        )
        .setColor(0xf39c12);

      await interaction.editReply({ embeds: [embed] });
      console.log(`[${timestamp}] [RULES] Completed in ${Date.now() - startTime}ms - no rules found for ${className}`);
      return;
    }

    // Discord allows up to 10 embeds per message
    const embedsToSend = embeds.slice(0, 10);

    await interaction.editReply({ embeds: embedsToSend });
    console.log(`[${timestamp}] [RULES] Completed in ${Date.now() - startTime}ms - ${className} all formats (${embeds.length} embeds)`);
  },

  /**
   * Show all rules for a specific format
   */
  async showFormatRules(interaction, rules, format, timestamp, startTime) {
    let formatSection = null;
    let title = '';
    let color = 0x3498db;

    switch (format) {
      case 'HLD':
        formatSection = rules.hld;
        title = '📜 High Level Duels (HLD) Rules';
        color = 0x3498db;
        break;
      case 'LLD':
        formatSection = rules.lld;
        title = '📜 Low Level Dueling (LLD) Rules';
        color = 0x9b59b6;
        break;
      case 'Melee':
        formatSection = rules.melee;
        title = '📜 Melee Duels Rules';
        color = 0xe67e22;
        break;
      case 'Team':
        formatSection = rules.team;
        title = '📜 Team Duels Rules';
        color = 0x2ecc71;
        break;
    }

    if (!formatSection || !formatSection.general) {
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(
          `Rules for ${format} format could not be loaded.\n\n` +
          `[📄 View Full Rules Document](${RULES_DOC_URL})`
        )
        .setColor(0xf39c12);

      await interaction.editReply({ embeds: [embed] });
      console.log(`[${timestamp}] [RULES] Completed in ${Date.now() - startTime}ms - ${format} not found`);
      return;
    }

    const embeds = [];

    // General rules for the format
    if (formatSection.general && formatSection.general.content) {
      const generalContent = rulesParser.convertToDiscordMarkdown(formatSection.general.content);
      const generalChunks = rulesParser.splitContent(generalContent, 4000);

      generalChunks.forEach((chunk, i) => {
        const embed = new EmbedBuilder()
          .setDescription(chunk)
          .setColor(color);

        if (i === 0) {
          embed.setTitle(title);
        }

        if (i === generalChunks.length - 1 && (!formatSection.classes || Object.keys(formatSection.classes).length === 0)) {
          embed.setFooter({ text: `Lines ${formatSection.general.lineStart}-${formatSection.general.lineEnd} | /rules for more options` });
        }

        embeds.push(embed);
      });
    }

    // Class-specific rules for HLD/LLD
    if (formatSection.classes && Object.keys(formatSection.classes).length > 0) {
      const classNames = Object.keys(formatSection.classes).sort();

      classNames.forEach(className => {
        const classRules = formatSection.classes[className];
        if (classRules && classRules.content) {
          const classContent = rulesParser.convertToDiscordMarkdown(classRules.content);
          const classChunks = rulesParser.splitContent(classContent, 4000);

          classChunks.forEach((chunk, i) => {
            const embed = new EmbedBuilder()
              .setDescription(chunk)
              .setColor(color);

            if (i === 0) {
              embed.setTitle(`${className} (${format})`);
            }

            embeds.push(embed);
          });
        }
      });

      // Add footer to last embed
      if (embeds.length > 0) {
        embeds[embeds.length - 1].setFooter({ text: `/rules format:${format} class:[class] for specific class | /rules for more options` });
      }
    }

    if (embeds.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(
          `No rules found for ${format} format.\n\n` +
          `[📄 View Full Rules Document](${RULES_DOC_URL})`
        )
        .setColor(0xf39c12);

      await interaction.editReply({ embeds: [embed] });
      console.log(`[${timestamp}] [RULES] Completed in ${Date.now() - startTime}ms - no content for ${format}`);
      return;
    }

    // Discord allows up to 10 embeds per message
    const embedsToSend = embeds.slice(0, 10);

    await interaction.editReply({ embeds: embedsToSend });
    console.log(`[${timestamp}] [RULES] Completed in ${Date.now() - startTime}ms - ${format} format (${embeds.length} embeds, sent ${embedsToSend.length})`);
  }
};
