require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const axios = require("axios");

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const medallas = {
    1: "Herald",
    2: "Guardian",
    3: "Crusader",
    4: "Archon",
    5: "Legend",
    6: "Ancient",
    7: "Divine",
    8: "Immortal"
};

const commands = [
    new SlashCommandBuilder()
        .setName("dota")
        .setDescription("Ver estadísticas Dota 2")
        .addStringOption(option =>
            option
                .setName("id")
                .setDescription("Account ID")
                .setRequired(true)
        )
].map(c => c.toJSON());

const rest = new REST({
    version: "10"
}).setToken(process.env.TOKEN);

(async () => {
    try {
        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            { body: commands }
        );

        console.log("✅ Comandos registrados");

    } catch (err) {
        console.log("Error registrando comandos:", err);
    }
})();

client.once("clientReady", () => {
    console.log(`${client.user.tag} conectado`);
});

client.on("interactionCreate", async interaction => {

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "dota") {

        await interaction.deferReply();

        try {

            const id = interaction.options.getString("id");

            const requests = [
                axios.get(
                    `https://api.opendota.com/api/players/${id}`,
                    { timeout: 10000 }
                ),

                axios.get(
                    `https://api.opendota.com/api/players/${id}/wl`,
                    { timeout: 10000 }
                ),

                axios.get(
                    `https://api.opendota.com/api/players/${id}/heroes`,
                    { timeout: 10000 }
                ),

                axios.get(
                    `https://api.opendota.com/api/heroStats`,
                    { timeout: 10000 }
                )
            ];

            const [
                player,
                wl,
                heroes,
                heroStats
            ] = await Promise.allSettled(requests);

            const datos =
                player.status === "fulfilled"
                    ? player.value.data
                    : {};

            const wlData =
                wl.status === "fulfilled"
                    ? wl.value.data
                    : {};

            const heroesJugador =
                heroes.status === "fulfilled"
                    ? heroes.value.data
                    : [];

            const heroesData =
                heroStats.status === "fulfilled"
                    ? heroStats.value.data
                    : [];

            if (!datos.profile) {
                return interaction.editReply(
                    "❌ No se encontró ese jugador o OpenDota está caído."
                );
            }

            const wins = wlData.win ?? 0;
            const losses = wlData.lose ?? 0;
            const partidas = wins + losses;

            const winrate =
                partidas > 0
                    ? ((wins / partidas) * 100).toFixed(2) + "%"
                    : "No disponible";

            let rango = "No disponible";

            if (datos.rank_tier) {

                const tier = Math.floor(
                    datos.rank_tier / 10
                );

                const estrellas =
                    datos.rank_tier % 10;

                rango =
                    `${medallas[tier] || "?"} ${estrellas}`;
            }

            const mmr =
                datos.mmr_estimate?.estimate
                    ? datos.mmr_estimate.estimate
                    : "No disponible";

            let heroeMasJugado = "Sin datos";
            let heroeMejorWR = "Sin datos";

            if (heroesJugador.length > 0) {

                const topHero =
                    [...heroesJugador]
                        .sort(
                            (a, b) =>
                                b.games - a.games
                        )[0];

                const heroTop =
                    heroesData.find(
                        h => h.id === topHero.hero_id
                    );

                heroeMasJugado =
                    `${heroTop?.localized_name || "?"}
(${topHero.games} partidas)`;

                const mejores =
                    heroesJugador
                        .filter(
                            h => h.games >= 10
                        )
                        .sort(
                            (a, b) =>
                                (b.win / b.games)
                                -
                                (a.win / a.games)
                        );

                if (mejores.length > 0) {

                    const best = mejores[0];

                    const heroBest =
                        heroesData.find(
                            h => h.id === best.hero_id
                        );

                    const wr =
                        (
                            (best.win / best.games)
                            * 100
                        ).toFixed(2);

                    heroeMejorWR =
                        `${heroBest?.localized_name || "?"}
(${wr}%)`;
                }
            }

            const embed = new EmbedBuilder()

                .setTitle("📊 Estadísticas Dota 2")

                .setThumbnail(
                    datos.profile?.avatarfull
                )

                .addFields(
                    {
                        name: "👤 Jugador",
                        value: datos.profile?.personaname || "-",
                        inline: true
                    },
                    {
                        name: "🏅 Rango",
                        value: rango,
                        inline: true
                    },
                    {
                        name: "🏆 MMR",
                        value: String(mmr),
                        inline: true
                    },
                    {
                        name: "📈 Winrate",
                        value: winrate,
                        inline: true
                    },
                    {
                        name: "🎮 Partidas",
                        value: String(partidas),
                        inline: true
                    },
                    {
                        name: "✅ Victorias",
                        value: String(wins),
                        inline: true
                    },
                    {
                        name: "❌ Derrotas",
                        value: String(losses),
                        inline: true
                    },
                    {
                        name: "🔥 Héroe más jugado",
                        value: heroeMasJugado
                    },
                    {
                        name: "⭐ Mejor héroe (WR)",
                        value: heroeMejorWR
                    }
                )

                .setColor("Blue")

                .setFooter({
                    text: "Datos obtenidos desde OpenDota"
                })

                .setTimestamp();

            await interaction.editReply({
                embeds: [embed]
            });

        } catch (error) {

            console.log("ERROR:");

            console.log(error);

            await interaction.editReply(
                "❌ Error obteniendo estadísticas."
            );
        }
    }
});

client.login(process.env.TOKEN);