const { ChatInputCommandInteraction, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require("discord.js");
const DiscordBot = require("../../client/DiscordBot");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'postjob',
        description: 'Send a message in a recruitment channel with a job listing.',
        type: 1,
        options: [
            {
                name: 'channel',
                description: 'Select the channel to post in',
                type: 3, // String type
                required: true,
                choices: [
                    { name: 'Public Sector', value: 'public_sector' },
                    { name: 'Private Sector', value: 'private_sector' }
                ]
            },
            {
                name: 'json',
                description: 'JSON code to build the embed',
                type: 3, // String type
                required: true
            },
            {
                name: 'button_label',
                description: 'Label for the button (optional)',
                type: 3, // String type
                required: false
            },
            {
                name: 'button_url',
                description: 'URL for the button (optional)',
                type: 3, // String type
                required: false
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
        const channelChoice = interaction.options.getString('channel');
        const jsonCode = interaction.options.getString('json');
        const buttonLabel = interaction.options.getString('button_label');
        const buttonUrl = interaction.options.getString('button_url');

        // Mapping channel choices to IDs
        const channels = {
            'public_sector': '1273609982025269301', // Replace with actual channel ID
            'private_sector': '1273609996612931819'  // Replace with actual channel ID
        };

        // Role checking (Replace with actual role IDs)
        const roles = {
            'public_sector': [
                '1273227128833314919', // Main role for Public Sector
                '1273216980798803968', // Additional role 1
                '1273217048578625536', // Additional role 2
                '1273217828371038271'  // Additional role 3
            ],
            'private_sector': '1273227170076168223'
        };

        // Check if the user has the appropriate role to post in the selected channel
        const userRoles = interaction.member.roles.cache.map(role => role.id);
        const hasPermission = Array.isArray(roles[channelChoice])
            ? roles[channelChoice].some(roleId => userRoles.includes(roleId))
            : userRoles.includes(roles[channelChoice]);

        if (!hasPermission) {
            return interaction.reply({ content: 'You do not have the required role to post in this channel.', ephemeral: true });
        }

        // Extract user information
        const user = interaction.user;
        const authorName = user.username;
        const authorIconUrl = user.displayAvatarURL();

        // Try parsing the JSON code to create an embed
        let embed;
        try {
            const jsonData = JSON.parse(jsonCode);

            // Add author information to the embed
            embed = new EmbedBuilder(jsonData)
                .setAuthor({ name: authorName, iconURL: authorIconUrl })
                .setTimestamp();
        } catch (err) {
            console.error('Invalid JSON provided:', err.message);
            return interaction.reply({ content: 'Invalid JSON code provided. Please ensure your JSON is correctly formatted according to Discord\'s embed structure.', ephemeral: true });
        }

        const channel = client.channels.cache.get(channels[channelChoice]);
        if (!channel) {
            return interaction.reply({ content: 'Channel not found.', ephemeral: true });
        }

        const components = [];
        if (buttonLabel && buttonUrl) {
            const button = new ButtonBuilder()
                .setLabel(buttonLabel)
                .setURL(buttonUrl)
                .setStyle(ButtonStyle.Link);

            const actionRow = new ActionRowBuilder().addComponents(button);
            components.push(actionRow);
        }

        try {
            await channel.send({ embeds: [embed], components });
            return interaction.reply({ content: 'Job listing posted successfully!', ephemeral: true });
        } catch (error) {
            console.error('Error sending message:', error);
            return interaction.reply({ content: 'Failed to send the job listing.', ephemeral: true });
        }
    }
}).toJSON();
