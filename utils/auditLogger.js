/**
 * Audit Logger Utility
 *
 * Logs all slash command invocations to the Discord audit-log channel
 * in production environment only.
 */

const { EmbedBuilder } = require('discord.js');

/**
 * Serializes command arguments from interaction options
 * @param {Array} optionsData - interaction.options.data array
 * @returns {string|null} JSON string of arguments or null if empty
 */
function serializeArguments(optionsData) {
    if (!optionsData || optionsData.length === 0) return null;

    const args = {};
    for (const option of optionsData) {
        args[option.name] = option.value;
    }

    return JSON.stringify(args, null, 2);
}

/**
 * Formats a Discord embed for audit logging
 * @param {Object} data - Audit log data
 * @returns {EmbedBuilder} Formatted Discord embed
 */
function formatAuditEmbed(data) {
    const {
        commandName,
        user,
        channel,
        duration,
        arguments: args,
        success,
        error
    } = data;

    const embed = new EmbedBuilder()
        .setColor(success ? 0x00FF00 : 0xFF0000)
        .setTitle(`${success ? '✅ Command Executed' : '❌ Command Failed'}: /${commandName}`)
        .setTimestamp()
        .setFooter({ text: 'Production' });

    // Add user field
    embed.addFields({
        name: '👤 User',
        value: `${user.tag} (${user.id})`,
        inline: true
    });

    // Add channel field
    embed.addFields({
        name: '📍 Channel',
        value: `#${channel.name} (${channel.id})`,
        inline: true
    });

    // Add duration field
    const durationSeconds = (duration / 1000).toFixed(2);
    embed.addFields({
        name: '⏱️ Duration',
        value: `${durationSeconds}s`,
        inline: true
    });

    // Add arguments field if present
    if (args) {
        embed.addFields({
            name: '📝 Arguments',
            value: `\`\`\`json\n${args}\n\`\`\``,
            inline: false
        });
    }

    // Add error field if present
    if (error) {
        const errorMessage = error.message || String(error);
        const truncatedError = errorMessage.length > 1024
            ? errorMessage.substring(0, 1021) + '...'
            : errorMessage;

        embed.addFields({
            name: '❗ Error',
            value: truncatedError,
            inline: false
        });
    }

    return embed;
}

/**
 * Sends embed to audit channel
 * @param {Client} client - Discord.js client
 * @param {EmbedBuilder} embed - Formatted embed
 */
async function sendToAuditChannel(client, embed) {
    try {
        const channelId = process.env.AUDIT_CHANNEL_ID;

        if (!channelId) {
            console.warn('[Audit Log] AUDIT_CHANNEL_ID not configured, logging to console instead');
            console.log('[Audit Log]', embed.toJSON());
            return;
        }

        const channel = client.channels.cache.get(channelId);

        if (!channel) {
            console.warn(`[Audit Log] Channel ${channelId} not found, logging to console instead`);
            console.log('[Audit Log]', embed.toJSON());
            return;
        }

        // Non-blocking send (don't await)
        channel.send({ embeds: [embed] }).catch(err => {
            console.error('[Audit Log] Failed to send to Discord:', err.message);
        });

    } catch (error) {
        console.error('[Audit Log] Unexpected error:', error.message);
    }
}

/**
 * Wraps command execution with audit logging
 * @param {Client} client - Discord.js client
 * @param {Interaction} interaction - Discord interaction object
 * @param {string} commandName - Name of the command being executed
 * @param {Function} executeFunc - Async function to execute (command.execute)
 */
async function logCommandExecution(client, interaction, commandName, executeFunc) {
    // Only log commands executed in production guild
    const isProduction = interaction.guildId === process.env.PROD_GUILD_ID;

    if (!isProduction) {
        // Not production - execute without logging
        await executeFunc();
        return;
    }

    // Capture pre-execution data
    const startTime = Date.now();
    const userData = {
        tag: interaction.user.tag,
        id: interaction.user.id
    };
    const channelData = {
        name: interaction.channel?.name || 'DM',
        id: interaction.channelId
    };
    const args = serializeArguments(interaction.options?.data);

    try {
        // Execute command
        await executeFunc();

        // Calculate duration
        const duration = Date.now() - startTime;

        // Format success embed
        const embed = formatAuditEmbed({
            commandName,
            user: userData,
            channel: channelData,
            duration,
            arguments: args,
            success: true
        });

        // Send to audit channel (non-blocking, fail-safe)
        sendToAuditChannel(client, embed).catch(err => {
            console.error('[Audit Log] Failed to log success:', err.message);
        });

    } catch (error) {
        // Calculate duration
        const duration = Date.now() - startTime;

        // Format error embed
        const embed = formatAuditEmbed({
            commandName,
            user: userData,
            channel: channelData,
            duration,
            arguments: args,
            success: false,
            error
        });

        // Send to audit channel (non-blocking, fail-safe)
        sendToAuditChannel(client, embed).catch(err => {
            console.error('[Audit Log] Failed to log error:', err.message);
        });

        // Re-throw error to maintain existing error handling
        throw error;
    }
}

module.exports = {
    logCommandExecution
};
