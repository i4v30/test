const { MessageEmbed, Client } = require('discord.js');
const { readFileSync, writeFileSync } = require('fs');
const express = require("express");
const keepAlive = require('./server.js');
const client = new Client();

// Load configuration
const loadConfig = () => {
    try {
        return JSON.parse(readFileSync('config.json', 'utf8'));
    } catch (err) {
        console.error('Error loading config:', err);
        return {};
    }
};

let config = loadConfig();
let suggestionChannelId = config.suggestionChannelId;
const link = config.imageLink;

client.on('ready', () => {
    console.log(`[NAME] ${client.user.tag}`);
    console.log(`[GUILDS] ${client.guilds.cache.size}`);
    client.user.setStatus("online");

    const updateStatus = () => {
        const status = [`i4`];
        const randomStatus = status[Math.floor(Math.random() * status.length)];
        client.user.setActivity(randomStatus, { type: 'PLAYING' });
    };

    setInterval(updateStatus, 7000);
});

// Load command handlers
const commandHandlers = {
    help: (message) => {
        const helpEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle('قائمة الأوامر')
            .setDescription('إليك قائمة بالأوامر المتاحة:')
            .addFields(
                { name: `${config.prefix}setup`, value: 'يستخدم لتعيين قناة الاقتراحات. يجب أن تكون لديك صلاحية إدارة القنوات.' },
                { name: `${config.prefix}setup react <upvote_emoji> <downvote_emoji>`, value: 'يستخدم لتحديث الرموز التعبيرية للتصويت على الاقتراحات.' },
                { name: `${config.prefix}setup line <length>`, value: 'يستخدم لتغيير الحد الأقصى لطول الاقتراحات.' },
                { name: `${config.prefix}setup imageLink <link>`, value: 'يستخدم لتعيين رابط الصورة المستخدم في الاقتراحات.' },
                { name: `${config.prefix}help`, value: 'يعرض قائمة الأوامر المتاحة.' }
            )
            .setTimestamp();

        return message.channel.send(helpEmbed);
    },

    setup: (message, args) => {
        if (!message.member.permissions.has("MANAGE_CHANNELS")) {
            return message.reply("ليس لديك الكفاية من الصلاحيات لإجراء الإعدادات.");
        }

        const subCommand = args[1];
        switch (subCommand) {
            case undefined:
                return message.reply("يرجى إضافة إحدى الخيارات: `react`، `line`، `imageLink` أو الإشارة إلى قناة.");
            case "react":
                return handleReactCommand(message, args);
            case "line":
                return handleLineCommand(message, args);
            case "imageLink":
                return handleImageLinkCommand(message, args);
            default:
                return handleChannelSetup(message, args);
        }
    }
};

// Handle the channel setup command
const handleChannelSetup = (message, args) => {
    const channel = message.mentions.channels.first();
    if (!channel) {
        return message.reply("يرجى الإشارة إلى قناة صحيحة لتعيينها كقناة اقتراحات.");
    }

    suggestionChannelId = channel.id;
    config.suggestionChannelId = suggestionChannelId;
    writeFileSync('config.json', JSON.stringify(config, null, 2));
    message.channel.send(`تم إعداد قناة الاقتراحات إلى ${channel}.`);
};

// Handle the emoji setup command
const handleReactCommand = (message, args) => {
    const upvote = args[2] || config.upvoteEmoji; 
    const downvote = args[3] || config.downvoteEmoji; 
    if (!upvote || !downvote) {
        return message.reply("يرجى إدخال الرموز التعبيرية للتصويت. على سبيل المثال: `setup react 👍 👎`");
    }

    config.upvoteEmoji = upvote;
    config.downvoteEmoji = downvote;

    writeFileSync('config.json', JSON.stringify(config, null, 2));
    message.channel.send(`تم تحديث الرموز التعبيرية ، Upvote: ${upvote}, Downvote: ${downvote}`);
};

// Handle the line length command
const handleLineCommand = (message, args) => {
    const length = parseInt(args[2]);
    if (isNaN(length) || length <= 0) {
        return message.reply("يرجى إدخال طول صحيح أكبر من صفر.");
    }

    config.maxSuggestionLength = length;
    writeFileSync('config.json', JSON.stringify(config, null, 2));
    message.channel.send(`تم تعيين الحد الأقصى لطول الاقتراحات إلى ${length} حرف.`);
};

// Handle the image link command
const handleImageLinkCommand = (message, args) => {
    const newLink = args[2];
    if (!newLink) {
        return message.reply("يرجى إدخال رابط الصورة. على سبيل المثال: `setup imageLink http://example.com/image.png`.");
    }

    config.imageLink = newLink; 
    writeFileSync('config.json', JSON.stringify(config, null, 2));
    message.channel.send(`تم تحديث رابط الصورة إلى ${newLink}`);
};

// Message handler
client.on('message', async (message) => {
    if (message.author.bot) return;

    const args = message.content.split(" ");
    const command = args[0].toLowerCase();

    if (command === `${config.prefix}help`) {
        return commandHandlers.help(message);
    }

    if (command.startsWith(config.prefix)) {
        const baseCommand = command.slice(config.prefix.length);
        if (baseCommand === "setup") {
            return commandHandlers.setup(message, args);
        }
    }

    // Ensure message is in the suggestion channel
    if (message.channel.id === suggestionChannelId) {
        if (args.join(" ").length > config.maxSuggestionLength) {
            return message.reply(`تجاوز اقتراحك الحد الأقصى لطول الاقتراح (${config.maxSuggestionLength} حرف).`);
        }

        await message.delete();
        const embed = new MessageEmbed()
            .setAuthor(`${message.author.username}`, message.author.displayAvatarURL({ dynamic: true }))
            .setColor('BLACK')
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setDescription(`**${args.join(" ")}**`)
            //.setTimestamp();
      .setFooter(message.guild.name, message.guild.iconURL());

        const attachment = message.attachments.first();
        if (attachment) {
            embed.setImage(attachment.proxyURL);
        }

        const sentMessage = await message.channel.send(embed);
        await sentMessage.react(config.upvoteEmoji);
        await sentMessage.react(config.downvoteEmoji);
        message.channel.send({ files: [config.imageLink] });
    }
});

// Login the bot
client.login(process.env.token).catch((err) => {
    console.warn("\033[31m Token Invalid");
});