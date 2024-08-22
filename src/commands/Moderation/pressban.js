const { ChatInputCommandInteraction } = require("discord.js");
const DiscordBot = require("../../client/DiscordBot");
const ApplicationCommand = require("../../structure/ApplicationCommand");


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
        name: 'pressban',
        description: 'Select an event which you wish to host.',
        type: 1,
        options: []
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

        // Generate a unique token
        const token = generateToken(16); // Adjust length as needed

    }
}).toJSON();