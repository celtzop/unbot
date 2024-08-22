const { ChatInputCommandInteraction, EmbedBuilder } = require("discord.js");
const DiscordBot = require("../../client/DiscordBot");
const ApplicationCommand = require("../../structure/ApplicationCommand");
const WarnModel = require("../../models/warning"); // Ensure this is updated
const mongoose = require('mongoose'); // Ensure mongoose is imported for MongoDB integration

/**
 * Generate a random token with uppercase letters and numbers.
 * @param {number} length - The length of the token.
 * @returns {string} - The generated token.
 */
function generateToken(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters[randomIndex];
    }
    return result;
}

module.exports = new ApplicationCommand({
    command: {
        name: 'warn',
        description: 'Warn a user in the United Nations server',
        type: 1,
        options: [
            {
                name: 'user',
                description: 'The user to warn',
                type: 6, // User type
                required: true
            },
            {
                name: 'reason',
                description: 'Reason for warning the user',
                type: 3, // String type
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
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        
        if (!targetUser) {
            return interaction.reply({ content: "User not found.", ephemeral: true });
        }

        // Generate a unique token
        const token = generateToken(16); // Adjust length as needed

        // Create an embed for the warning DM
        const warningEmbed = new EmbedBuilder()
            .setTitle("You have been warned")
            .setThumbnail(targetUser.displayAvatarURL({ format: 'png', size: 128 })) // Adds user's profile picture as thumbnail
            .setDescription(`You have been warned in the United Nations server for the following reason:\n**${reason}**\n\nIf you believe this was a mistake, you can appeal the warning by contacting the server moderators.`)
            .setTimestamp();

        // DM the user
        try {
            await targetUser.send({ embeds: [warningEmbed] });
        } catch (err) {
            console.log(`Could not send DM to ${targetUser.tag}. They may have DMs disabled.`);
        }
        
        // Log the warning in the specified channel
        const logChannel = client.channels.cache.get('1275914968474189855');
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setDescription(`## ${targetUser} has been warned \n User: ${targetUser}, ${targetUser.id} \n Moderator: ${interaction.user}, ${interaction.user.id} \n Reason: ${reason} \n Token: ${token}`)
                .setThumbnail(targetUser.displayAvatarURL({ format: 'png', size: 128 })) // Adds user's profile picture as thumbnail
                .setColor(`#4461b8`)
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
        }

        // Store the warning in MongoDB
        const warnData = new WarnModel({
            userId: targetUser.id,
            userName: targetUser.tag,
            moderatorId: interaction.user.id,
            moderatorName: interaction.user.tag,
            reason: reason,
            date: new Date(),
            uniqueToken: token // Added token field
        });

        try {
            await warnData.save();
            console.log(`Warning information for ${targetUser.tag} saved to the database.`);
        } catch (err) {
            console.error(`Failed to save warning information to the database: ${err}`);
        }

        // Acknowledge the command execution
        return interaction.reply({ content: `User ${targetUser.tag} has been warned.`, ephemeral: true });
    }
}).toJSON();
