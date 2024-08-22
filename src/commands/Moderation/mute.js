const { ChatInputCommandInteraction, EmbedBuilder } = require("discord.js");
const DiscordBot = require("../../client/DiscordBot");
const ApplicationCommand = require("../../structure/ApplicationCommand");
const MuteModel = require("../../models/mute"); // Assuming you have a mongoose model set up for mute

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
        name: 'mute',
        description: 'Timeout a user in the United Nations server',
        type: 1,
        options: [
            {
                name: 'user',
                description: 'The user to mute',
                type: 6, // User type
                required: true
            },
            {
                name: 'duration',
                description: 'Duration of the mute in minutes',
                type: 4, // Integer type
                required: true
            },
            {
                name: 'reason',
                description: 'Reason for the mute',
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
        const duration = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        
        // Generate a unique token
        const token = generateToken(16); // Adjust length as needed

        if (!targetUser) {
            return interaction.reply({ content: "User not found.", ephemeral: true });
        }

        // Convert duration from minutes to milliseconds
        const timeoutDuration = duration * 60 * 1000; // Duration in milliseconds

        // Create an embed for the mute DM
        const muteEmbed = new EmbedBuilder()
            .setTitle("You have been muted")
            .setThumbnail(targetUser.displayAvatarURL({ format: 'png', size: 128 })) // Adds user's profile picture as thumbnail
            .setDescription(`You have been muted in the United Nations server for the following reason:\n**${reason}**\n\nDuration: ${duration} minutes\n\nIf you believe this was a mistake, you can appeal the mute by contacting the server moderators.`)
            .setTimestamp();

        // DM the user
        try {
            await targetUser.send({ embeds: [muteEmbed] });
        } catch (err) {
            console.log(`Could not send DM to ${targetUser.tag}. They may have DMs disabled.`);
        }

        // Apply timeout to the user
        try {
            const member = await interaction.guild.members.fetch(targetUser.id);
            if (!member) {
                return interaction.reply({ content: "User is not a member of this server.", ephemeral: true });
            }

            await member.timeout(timeoutDuration, reason); // Apply the timeout to the member
            await interaction.reply({ content: `${targetUser.tag} has been muted for ${duration} minutes for: ${reason}`, ephemeral: true });
        } catch (err) {
            console.error(`Failed to mute user: ${err}`);
            return interaction.reply({ content: "Failed to mute the user.", ephemeral: true });
        }

        // Log the mute in the specified channel
        const logChannel = client.channels.cache.get('1275914968474189855');
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setDescription(`## ${targetUser} has been muted \n User: ${targetUser}, ${targetUser.id} \n Moderator: ${interaction.user}, ${interaction.user.id} \n Reason: ${reason} \n Duration: ${duration} minutes \n Token: ${token}`)
                .setThumbnail(targetUser.displayAvatarURL({ format: 'png', size: 128 })) // Adds user's profile picture as thumbnail
                .setColor(`#4461b8`)
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
        }

        // Store the mute in MongoDB
        const muteData = new MuteModel({
            userId: targetUser.id,
            userName: targetUser.tag,
            moderatorId: interaction.user.id,
            moderatorName: interaction.user.tag,
            reason: reason,
            duration: duration,
            date: new Date(),
            uniqueToken: token // Added token field
        });

        try {
            await muteData.save();
            console.log(`Mute information for ${targetUser.tag} saved to the database.`);
        } catch (err) {
            console.error(`Failed to save mute information to the database: ${err}`);
        }
    }
}).toJSON();
