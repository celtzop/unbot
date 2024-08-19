const { ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const noblox = require('noblox.js');
const Trello = require('../../utils/trelloUtils');
require('dotenv').config();

const trelloClient = new Trello(process.env.TRELLO_API_KEY, process.env.TRELLO_TOKEN);

module.exports = {
    data: {
        name: 'userinfo',
        description: 'Returns Roblox user information',
        options: [
            {
                type: 3, // STRING
                name: 'username',
                description: 'The Roblox username to check.',
                required: true,
            },
        ],
    },
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const username = interaction.options.getString('username');
            const userId = await noblox.getIdFromUsername(username);
            const userInfo = await noblox.getPlayerInfo(userId);
            const thumbnails = await noblox.getPlayerThumbnail(userId, 420, 'png', false, 'headshot');
            const thumbnailUrl = thumbnails[0]?.imageUrl || 'https://example.com/default-thumbnail.png';
            const userAvatarUrl = interaction.user.displayAvatarURL({ format: 'png', size: 2048 });

            const alertLog = new EmbedBuilder()
                .setDescription(`**Information Retrieval Log**\n${interaction.user.username} has requested information on [${username}](https://www.roblox.com/users/${userId}/profile)\nCommand Used: userinfo\nChannel: [${interaction.channel.name}](https://discord.com/channels/${interaction.guild.id}/${interaction.channel.id})\nGuild: ${interaction.guild.name}`)
                .setTimestamp()
                .setThumbnail(userAvatarUrl)
                .setColor('#ff33e6');

            const logChannel = interaction.guild.channels.cache.get('1269443688099221515');
            if (logChannel) {
                logChannel.send({ embeds: [alertLog] });
            } else {
                console.error('Log channel not found');
            }

            const embed = new EmbedBuilder()
                .setTitle(`User Info for ${username}`)
                .addFields(
                    { name: 'Username', value: userInfo.username ?? 'N/A', inline: true },
                    { name: 'User ID', value: userInfo.userId?.toString() ?? 'N/A', inline: true },
                    { name: 'Display Name', value: userInfo.displayName ?? 'N/A', inline: true },
                    { name: 'Friends Count', value: userInfo.friendCount?.toString() ?? 'N/A', inline: true },
                    { name: 'Followers Count', value: userInfo.followerCount?.toString() ?? 'N/A', inline: true },
                    { name: 'Following Count', value: userInfo.followingCount?.toString() ?? 'N/A', inline: true },
                    { name: 'Account Age (days)', value: userInfo.age?.toString() ?? 'N/A', inline: true }
                )
                .setThumbnail(thumbnailUrl)
                .setColor('#33ff68')
                .setFooter({ text: `Information Retrieval requested by ${interaction.user.username}` });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('view_groups')
                        .setLabel('View Groups')
                        .setEmoji('🏢')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('view_friends')
                        .setLabel('View Friends')
                        .setEmoji('👥')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('view_incidents')
                        .setLabel('View Incidents')
                        .setEmoji('🚨')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('view_notes')
                        .setLabel('View Notes')
                        .setEmoji('📝')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setURL(`https://www.roblox.com/users/${userId}/profile`)
                        .setLabel('Profile Link')
                        .setEmoji('📎')
                        .setStyle(ButtonStyle.Link)
                );

            await interaction.followUp({ embeds: [embed], components: [row] });

            const filter = i => (['view_groups', 'view_friends', 'view_incidents', 'view_notes'].includes(i.customId)) && i.user.id === interaction.user.id;
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async i => {
                if (i.customId === 'view_incidents') {
                    const listId = 'INCIDENTS_LIST_ID'; // Replace with your actual list ID
                    const labels = ['TOP SECRET', 'MID SECRET', 'SECRET'];
                    const userRoles = interaction.member.roles.cache.map(role => role.name);
                    const allowedLabels = labels.filter(label => userRoles.includes(label));

                    if (allowedLabels.length === 0) {
                        await i.update({ content: 'You do not have the required roles to view incidents.', components: [] });
                        return;
                    }

                    const cards = await trelloClient.getCardsOnList(listId);
                    const collaboratorIds = ['boysonsis310', 'WikiPL136', 'finndad', 'jologamer12345678', 'cuh_Ifo', 'tudor_kingf', 'Hellothere37172'];
                    const userCollaborator = collaboratorIds.includes(interaction.user.username);

                    const filteredCards = cards.filter(card => {
                        const hasAllowedLabel = card.labels.some(label => allowedLabels.includes(label.name));
                        return hasAllowedLabel && userCollaborator;
                    });

                    if (filteredCards.length === 0) {
                        await i.update({ content: 'No incidents found for your roles and collaborations.', components: [] });
                        return;
                    }

                    const generateIncidentEmbed = (start) => {
                        const currentCards = filteredCards.slice(start, start + 15);
                        const description = currentCards.map(card => `[${card.name}](https://trello.com/c/${card.id})`).join('\n');

                        return new EmbedBuilder()
                            .setColor('#FF5733')
                            .setThumbnail(thumbnailUrl)
                            .setDescription(`**Incidents for ${username}**\n${description}`)
                            .setFooter({ text: `Information Retrieval requested by ${interaction.user.username}` });
                    };

                    let currentIndex = 0;
                    const incidentEmbed = generateIncidentEmbed(currentIndex);

                    const nextButton = new ButtonBuilder()
                        .setCustomId('next_incident')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('➡️')
                        .setDisabled(filteredCards.length <= 15);

                    const prevButton = new ButtonBuilder()
                        .setCustomId('prev_incident')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⬅️')
                        .setDisabled(true);

                    const actionRow = new ActionRowBuilder()
                        .addComponents(prevButton, nextButton);

                    await i.reply({ embeds: [incidentEmbed], components: [actionRow] });

                    const scrollFilter = i => ['next_incident', 'prev_incident'].includes(i.customId) && i.user.id === interaction.user.id;
                    const scrollCollector = i.channel.createMessageComponentCollector({ filter: scrollFilter, time: 60000 });

                    scrollCollector.on('collect', async i => {
                        if (i.customId === 'next_incident') {
                            currentIndex += 15;
                        } else if (i.customId === 'prev_incident') {
                            currentIndex -= 15;
                        }

                        const newEmbed = generateIncidentEmbed(currentIndex);

                        await i.update({
                            embeds: [newEmbed],
                            components: [
                                new ActionRowBuilder()
                                    .addComponents(
                                        new ButtonBuilder()
                                            .setCustomId('prev_incident')
                                            .setLabel('Previous')
                                            .setStyle(ButtonStyle.Primary)
                                            .setEmoji('⬅️')
                                            .setDisabled(currentIndex === 0),
                                        new ButtonBuilder()
                                            .setCustomId('next_incident')
                                            .setLabel('Next')
                                            .setStyle(ButtonStyle.Primary)
                                            .setEmoji('➡️')
                                            .setDisabled(currentIndex + 15 >= filteredCards.length)
                                    )
                            ]
                        });
                    });

                    scrollCollector.on('end', collected => {
                        if (collected.size === 0) {
                            i.editReply({ content: 'The button interaction timed out.', components: [] });
                        }
                    });
                } else if (i.customId === 'view_notes') {
                    await i.update({ content: 'Notes functionality is not implemented yet.', components: [] });
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    interaction.editReply({ content: 'The button interaction timed out.', components: [] });
                }
            });

        } catch (error) {
            console.error('Error while fetching user information:', error);
            await interaction.editReply({ content: 'An error occurred while fetching user information.' });
        }
    },
}.toJSON();