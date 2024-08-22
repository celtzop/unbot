const { ChatInputCommandInteraction, EmbedBuilder } = require('discord.js');
const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const BanModel = require('../../models/ban');
const KickModel = require('../../models/kick');
const MuteModel = require('../../models/mute');
const PressBanModel = require('../../models/pressban');
const WarningModel = require('../../models/warning');
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

// Function to create standardized embeds
function createEmbed({ title = 'No Title', description = 'No Description', color = '#ffffff', user, moderator, reason, token, actionType }) {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setThumbnail(user ? user.displayAvatarURL({ format: 'png', size: 128 }) : null)
        .setTimestamp();

    if (user) {
        embed.addFields(
            { name: 'User', value: `${user} (${user.id})`, inline: true }
        );
    }
    
    if (moderator) {
        embed.addFields(
            { name: 'Moderator', value: `${moderator} (${moderator.id})`, inline: true }
        );
    }

    if (reason) {
        embed.addFields(
            { name: 'Reason', value: reason, inline: false }
        );
    }

    if (token) {
        embed.addFields(
            { name: 'Token', value: token, inline: false }
        );
    }
    
    if (actionType) {
        embed.addFields(
            { name: 'Type', value: actionType, inline: true }
        );
    }

    return embed;
}

module.exports = new ApplicationCommand({
    command: {
        name: 'remove',
        description: 'Remove a moderation action from a user\'s account',
        type: 1,
        options: [
            {
                name: 'user',
                description: 'The user whose action you want to remove',
                type: 6, // User type
                required: true
            },
            {
                name: 'unique_token',
                description: 'The unique token of the action to remove',
                type: 3, // String type
                required: true
            },
            {
                name: 'type',
                description: 'The type of moderation action (ban, kick, mute, pressban, warning)',
                type: 3, // String type
                required: true,
                choices: [
                    { name: 'Ban', value: 'Ban' },
                    { name: 'Kick', value: 'Kick' },
                    { name: 'Mute', value: 'Mute' },
                    { name: 'Press Ban', value: 'PressBan' },
                    { name: 'Warning', value: 'Warning' }
                ]
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
        const user = interaction.options.getUser('user');
        const uniqueToken = interaction.options.getString('unique_token');
        const actionType = interaction.options.getString('type');

        let model;
        switch (actionType) {
            case 'Ban':
                model = BanModel;
                break;
            case 'Kick':
                model = KickModel;
                break;
            case 'Mute':
                model = MuteModel;
                break;
            case 'PressBan':
                model = PressBanModel;
                break;
            case 'Warning':
                model = WarningModel;
                break;
            default:
                return interaction.reply({ content: 'Invalid action type specified.', ephemeral: true });
        }

        try {
            // Find and remove the action
            const result = await model.deleteOne({ userId: user.id, uniqueToken: uniqueToken });
            if (result.deletedCount === 0) {
                return interaction.reply({ content: 'No matching action found.', ephemeral: true });
            }

            // Undo the action based on type
            if (actionType === 'Ban') {
                // Unban the user
                await interaction.guild.members.unban(user.id);
            } else if (actionType === 'Mute') {
                // Unmute the user (Remove timeout)
                const member = await interaction.guild.members.fetch(user.id);
                await member.timeout(null);
            } else if (actionType === 'PressBan') {
                // Remove pressban role
                const member = await interaction.guild.members.fetch(user.id);
                member.roles.remove('pressbanRoleId'); // Replace 'pressbanRoleId' with your pressban role ID
            }
            // Note: Kick and Warning actions do not require undoing since they do not have persistent effects

            // Send confirmation message
            const confirmationEmbed = new EmbedBuilder()
                .setDescription(`## ${actionType} removed \n ${actionType} has been removed from ${user}`)
                .setColor('#4461b8');
            await interaction.reply({ embeds: [confirmationEmbed], ephemeral: true });

        } catch (error) {
            logger.error(`Error removing action: ${error.message}`);
            const errorEmbed = createEmbed({
                title: 'Error',
                description: `An error occurred while trying to remove the action.`,
                color: '#ff0000'
            });
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        // Log the removal in the specified channel
        const logChannel = client.channels.cache.get('1275914968474189855');
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setDescription(`## ${actionType} removed from ${user}\nUser: ${user} (${user.id})\nModerator: ${interaction.user} (${interaction.user.id})\nAction: ${actionType}`)
                .setColor('#4461b8');
            await logChannel.send({ embeds: [logEmbed] });
        }
    }
}).toJSON();
