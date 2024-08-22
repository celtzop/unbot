const { ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const DiscordBot = require("../../client/DiscordBot");
const ApplicationCommand = require("../../structure/ApplicationCommand");
const BanModel = require("../../models/ban");
const KickModel = require("../../models/kick");
const MuteModel = require("../../models/mute");
const PressBanModel = require("../../models/pressban");
const WarningModel = require("../../models/warning");
const winston = require('winston');

// Setup logger
const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console()
    ]
});

// Function to serialize objects with BigInt
const serialize = (obj) => {
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'bigint') {
            return value.toString(); // Convert BigInt to string
        }
        return value;
    });
};

module.exports = new ApplicationCommand({
    command: {
        name: 'modlog',
        description: 'See a user\'s moderation log',
        type: 1,
        options: [
            {
                name: 'user',
                description: 'The user whose moderation log you want to see',
                type: 6, // User type
                required: true
            }
        ]
    },
    options: {
        cooldown: 5000
    },
    /**
     * 
     * @param {DiscordBot} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
    run: async (client, interaction) => {
        logger.debug(`Received interaction: ${serialize(interaction)}`);

        const targetUser = interaction.options.getUser('user');
        logger.debug(`Target user: ${targetUser.tag} (${targetUser.id})`);

        // Helper function to fetch logs from MongoDB
        const fetchLogs = async (model, page = 1) => {
            try {
                logger.debug(`Fetching logs for model: ${model.modelName} on page ${page}`);
                const perPage = 5;
                const logs = await model.find({ userId: targetUser.id })
                    .sort({ date: -1 })
                    .skip((page - 1) * perPage)
                    .limit(perPage);
                const totalLogs = await model.countDocuments({ userId: targetUser.id });
                const totalPages = Math.ceil(totalLogs / perPage);
                return { logs, totalPages };
            } catch (error) {
                logger.error(`Error fetching logs from model ${model.modelName}: ${error.message}`);
                throw error;
            }
        };

        // Function to format duration
        const formatDuration = (duration) => {
            if (duration === null) return 'N/A';
            const hours = Math.floor(duration / 3600000);
            const minutes = Math.floor((duration % 3600000) / 60000);
            const seconds = Math.floor((duration % 60000) / 1000);
            return `${hours}h ${minutes}m ${seconds}s`;
        };

        // Function to create an embed with the logs
        const createLogEmbed = (logs, type, page, totalPages) => {
            const embed = new EmbedBuilder()
                .setTitle(`${type} Logs for ${targetUser.tag}`)
                .setColor("#3446eb")
                .setThumbnail(targetUser.displayAvatarURL({ format: 'png', size: 128 })) // Adds user's profile picture as thumbnail
                .setTimestamp()
                .setFooter({ text: `Page ${page} of ${totalPages}` });

            if (logs.length > 0) {
                logs.forEach(log => {
                    let duration = '';
                    if (type === 'Press Ban' || type === 'Mute') {
                        duration = formatDuration(log.duration);
                    }
                    embed.addFields({
                        name: `Date: ${new Date(log.date).toLocaleString()}`,
                        value: `**Reason:** ${log.reason}\n**Moderator:** ${log.moderatorName}\n**Token:** ${log.uniqueToken}\n**Duration:** ${duration}`,
                        inline: false
                    });
                });
            } else {
                embed.setDescription(`No ${type} logs found for this user.`);
            }

            logger.debug(`Embed created: ${serialize(embed)}`);
            return embed;
        };

        // Create initial embed with buttons
        const createInitialEmbed = () => {
            return new EmbedBuilder()
                .setTitle(`Moderation Log for ${targetUser.tag}`)
                .setDescription(`Select the type of moderation log you want to view.`)
                .setColor("#3446eb")
                .setTimestamp();
        };

        // Function to create pagination buttons
        const createPaginationButtons = (action, page, totalPages) => {
            const prevPage = Math.max(page - 1, 1);
            const nextPage = Math.min(page + 1, totalPages);

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`${action}_pagePrevious_${prevPage}`)
                        .setLabel('Previous Page')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji(`↩️`)
                        .setDisabled(page <= 1),
                    new ButtonBuilder()
                        .setCustomId(`${action}_pageNext_${nextPage}`)
                        .setLabel('Next Page')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('↪️')
                        .setDisabled(page >= totalPages)
                );

            logger.debug(`Created pagination buttons with IDs: ${action}_pagePrevious_${prevPage}, ${action}_pageNext_${nextPage}`);

            return buttons;
        };

        // Create buttons for different moderation actions
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('bans_page_1')
                    .setLabel('Bans')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔨'),
                new ButtonBuilder()
                    .setCustomId('kicks_page_1')
                    .setLabel('Kicks')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('👢'),
                new ButtonBuilder()
                    .setCustomId('mutes_page_1')
                    .setLabel('Mutes')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔇'),
                new ButtonBuilder()
                    .setCustomId('press_bans_page_1')
                    .setLabel('Press Bans')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📰'),
                new ButtonBuilder()
                    .setCustomId('warnings_page_1')
                    .setLabel('Warnings')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⚠️')
            );

        // Send the initial embed with buttons
        try {
            logger.debug('Sending initial embed with buttons');
            await interaction.reply({ embeds: [createInitialEmbed()], components: [buttons] });
            logger.debug('Initial embed sent successfully');
        } catch (error) {
            logger.error(`Error sending initial reply: ${error.message}`);
            return; // Exit if the initial reply fails
        }

        // Create a collector to handle button interactions
        const filter = i => {
            const validActions = ['bans', 'kicks', 'mutes', 'press_bans', 'warnings'];
            const action = i.customId.split('_page_')[0];
            return validActions.includes(action) && i.user.id === interaction.user.id;
        };

        const collector = interaction.channel.createMessageComponentCollector({ filter });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.followUp({ content: "You can't use this button.", ephemeral: true });
            }

            const [action, , nextPageStr] = i.customId.split('_');
            const page = parseInt(nextPageStr, 10);

            let model;
            let type;

            switch (action) {
                case 'bans':
                    model = BanModel;
                    type = 'Ban';
                    break;
                case 'kicks':
                    model = KickModel;
                    type = 'Kick';
                    break;
                case 'mutes':
                    model = MuteModel;
                    type = 'Mute';
                    break;
                case 'press_bans':
                    model = PressBanModel;
                    type = 'Press Ban';
                    break;
                case 'warnings':
                    model = WarningModel;
                    type = 'Warning';
                    break;
                default:
                    return i.followUp({ content: 'Unknown action type.', ephemeral: true });
            }

            try {
                const { logs, totalPages } = await fetchLogs(model, page);
                const embed = createLogEmbed(logs, type, page, totalPages);
                const paginationButtons = createPaginationButtons(action, page, totalPages);

                // Update the interaction
                await i.update({ embeds: [embed], components: [paginationButtons] });
            } catch (error) {
                logger.error(`Error in collector: ${error.message}`);
                // Update interaction to notify user of error
                await i.reply({ content: 'There was an error processing your request.', components: [] });
            }
        });

        collector.on('end', collected => {
            logger.debug(`Interaction collector ended. Total interactions collected: ${collected.size}`);
            interaction.followUp({ components: [] });
        });
    }
}).toJSON();
