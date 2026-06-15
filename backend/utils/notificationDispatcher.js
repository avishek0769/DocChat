import prisma from "./prismaClient.js";

const WEBHOOK_CONFIG_KEY = "webhook_config";

export async function getWebhookConfig() {
    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key: WEBHOOK_CONFIG_KEY },
        });
        if (!setting) return null;
        return JSON.parse(setting.value);
    } catch {
        return null;
    }
}

export async function saveWebhookConfig(config) {
    await prisma.systemSetting.upsert({
        where: { key: WEBHOOK_CONFIG_KEY },
        update: { value: JSON.stringify(config) },
        create: { key: WEBHOOK_CONFIG_KEY, value: JSON.stringify(config) },
    });
}

function buildSlackPayload(alert) {
    return {
        blocks: [
            {
                type: "header",
                text: { type: "plain_text", text: `⚠️  ${alert.title}`, emoji: true },
            },
            {
                type: "section",
                text: { type: "mrkdwn", text: alert.message },
            },
            {
                type: "context",
                elements: [
                    {
                        type: "mrkdwn",
                        text: `*Severity:* ${alert.severity}  |  *Source:* ${alert.source}  |  *Time:* ${new Date().toISOString()}`,
                    },
                ],
            },
        ],
    };
}

function buildDiscordPayload(alert) {
    const colors = { critical: 15548997, warning: 16705372, info: 5793266 };
    return {
        embeds: [
            {
                title: alert.title,
                description: alert.message,
                color: colors[alert.severity] || colors.info,
                fields: [
                    { name: "Severity", value: alert.severity, inline: true },
                    { name: "Source", value: alert.source, inline: true },
                ],
                timestamp: new Date().toISOString(),
            },
        ],
    };
}

async function sendWebhook(url, payload) {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            console.error(`Webhook ${url} returned ${response.status}: ${await response.text()}`);
        }
        return response.ok;
    } catch (error) {
        console.error(`Failed to send webhook to ${url}:`, error.message);
        return false;
    }
}

export async function dispatchAlert(alert) {
    const config = await getWebhookConfig();
    if (!config) return;

    const enabled = config.enabledAlerts || [];
    if (!enabled.includes(alert.type)) return;

    const promises = [];

    if (config.slackUrl) {
        promises.push(sendWebhook(config.slackUrl, buildSlackPayload(alert)));
    }

    if (config.discordUrl) {
        promises.push(sendWebhook(config.discordUrl, buildDiscordPayload(alert)));
    }

    if (config.customUrl) {
        promises.push(sendWebhook(config.customUrl, alert));
    }

    await Promise.allSettled(promises);
}
