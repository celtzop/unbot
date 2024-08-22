const { ChatInputCommandInteraction, EmbedBuilder } = require("discord.js");
const DiscordBot = require("../../client/DiscordBot");
const ApplicationCommand = require("../../structure/ApplicationCommand");
const KickModel = require("../../models/kick"); // Assuming you have a mongoose model set up for kick

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
        name: 'kick',
        description: 'Kick a user from the United Nations server',
        type: 1,
        options: [
            {
                name: 'user',
                description: 'The user to kick',
                type: 6, // User type
                required: true
            },
            {
                name: 'reason',
                description: 'Reason for kicking the user',
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
        
        // Generate a unique token
        const token = generateToken(16); // Adjust length as needed

        if (!targetUser) {
            return interaction.reply({ content: "User not found.", ephemeral: true });
        }

        // Create an embed for the kick appeal DM
        const appealEmbed = new EmbedBuilder()
            .setTitle("You have been kicked")
            .setThumbnail(targetUser.displayAvatarURL({ format: 'png', size: 128 })) // Adds user's profile picture as thumbnail
            .setDescription(`You have been kicked from the United Nations server for the following reason:\n**${reason}**\n\nIf you believe this was a mistake, you can appeal the kick by contacting the server moderators.`)
            .setTimestamp();

        // DM the user
        try {
            await targetUser.send({ embeds: [appealEmbed] });
        } catch (err) {
            console.log(`Could not send DM to ${targetUser.tag}. They may have DMs disabled.`);
        }

        // kick the user
        try {
            await interaction.guild.members.kick(targetUser, { reason });
            await interaction.reply({ content: `${targetUser.tag} has been kicked for: ${reason}`, ephemeral: true });
        } catch (err) {
            console.error(`Failed to kick user: ${err}`);
            return interaction.reply({ content: "Failed to kick the user.", ephemeral: true });
        }

        // Log the kick in the specified channel
        const logChannel = client.channels.cache.get('1275914968474189855');
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle("User Kicked")
                .setThumbnail(targetUser.displayAvatarURL({ format: 'png', size: 128 })) // Adds user's profile picture as thumbnail
                .addFields(
                    { name: "User", value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: "Moderator", value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                    { name: "Reason", value: reason, inline: true },
                    { name: "Token", value: token, inline: true } // Added token field
                )
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
        }

        // Store the kick in MongoDB
        const kickData = new KickModel({
            userId: targetUser.id,
            userName: targetUser.tag,
            moderatorId: interaction.user.id,
            moderatorName: interaction.user.tag,
            reason: reason,
            date: new Date(),
            uniqueToken: token // Added token field
        });


        
        try {
            await kickData.save();
            console.log(`Kick information for ${targetUser.tag} saved to the database.`);
        } catch (err) {
            console.error(`Failed to save kick information to the database: ${err}`);
        }
    }
}).toJSON();
