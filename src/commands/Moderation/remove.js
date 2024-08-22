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

            // Send confirmation message
            const embed = new EmbedBuilder()
                .setTitle('Action Removed')
                .setDescription(`Successfully removed the ${actionType} action from ${user}.`)
                .setColor('#00ff00')
                .setThumbnail(user.displayAvatarURL({ format: 'png', size: 128 })) // Adds user's profile picture as thumbnail
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            logger.error(`Error removing action: ${error.message}`);
            await interaction.reply({ content: 'An error occurred while trying to remove the action.', ephemeral: true });
        }

 // Log the ban in the specified channel
 const logChannel = client.channels.cache.get('1275914968474189855');
 if (logChannel) {
     const logEmbed = new EmbedBuilder()
     .setDescription(`## ${actionType} removed from ${user}`)
         .setThumbnail(user.displayAvatarURL({ format: 'png', size: 128 })) // Adds user's profile picture as thumbnail
         .addFields(
             { name: "User", value: `${user} (${user.id})`, inline: true },
             { name: "Moderator", value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
             { name: "Type", value: `${actionType}`, inline: true },
         )
         .setTimestamp();
     await logChannel.send({ embeds: [logEmbed] });
 }


    }
}).toJSON();
