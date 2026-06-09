export const chatThemes = {
    default: {
        id: "default",
        name: "Default Dark",
        background: "linear-gradient(135deg, var(--color-background), var(--color-muted))",
        previewBg: "linear-gradient(135deg, #0b0f19, #1a2035)",
        bubbleSent: "bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-600 text-white rounded-br-sm shadow-[0_4px_15px_rgba(99,102,241,0.2)]",
        bubbleReceived: "bg-slate-900/35 backdrop-blur-md text-foreground rounded-bl-sm border border-slate-800/80 shadow-[0_4px_15px_rgba(0,0,0,0.15)]",
        accentColor: "indigo"
    },
    cyberpunk: {
        id: "cyberpunk",
        name: "Cyberpunk Neon",
        background: "linear-gradient(135deg, #2b0b3d 0%, #0c0824 100%)",
        previewBg: "linear-gradient(135deg, #2b0b3d, #0c0824)",
        bubbleSent: "bg-gradient-to-br from-fuchsia-600 via-pink-600 to-rose-600 text-white rounded-br-sm shadow-[0_4px_15px_rgba(219,39,119,0.3)] border border-pink-500/20",
        bubbleReceived: "bg-purple-950/45 backdrop-blur-md text-fuchsia-100 rounded-bl-sm border border-pink-500/30 shadow-[0_4px_15px_rgba(219,39,119,0.1)]",
        accentColor: "pink"
    },
    sunset: {
        id: "sunset",
        name: "Warm Sunset",
        background: "linear-gradient(135deg, #3a1c1c 0%, #1c0e2b 100%)",
        previewBg: "linear-gradient(135deg, #3a1c1c, #1c0e2b)",
        bubbleSent: "bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600 text-white rounded-br-sm shadow-[0_4px_15px_rgba(249,115,22,0.3)] border border-orange-500/10",
        bubbleReceived: "bg-amber-950/35 backdrop-blur-md text-amber-100 rounded-bl-sm border border-amber-500/20 shadow-[0_4px_15px_rgba(249,115,22,0.08)]",
        accentColor: "orange"
    },
    emerald: {
        id: "emerald",
        name: "Emerald Garden",
        background: "linear-gradient(135deg, #082416 0%, #05161c 100%)",
        previewBg: "linear-gradient(135deg, #082416, #05161c)",
        bubbleSent: "bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 text-white rounded-br-sm shadow-[0_4px_15px_rgba(16,185,129,0.3)] border border-emerald-500/15",
        bubbleReceived: "bg-emerald-950/30 backdrop-blur-md text-emerald-100 rounded-bl-sm border border-emerald-500/20 shadow-[0_4px_15px_rgba(16,185,129,0.08)]",
        accentColor: "emerald"
    },
    midnight: {
        id: "midnight",
        name: "Midnight Ocean",
        background: "linear-gradient(135deg, #051c24 0%, #030a1c 100%)",
        previewBg: "linear-gradient(135deg, #051c24, #030a1c)",
        bubbleSent: "bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-600 text-white rounded-br-sm shadow-[0_4px_15px_rgba(6,182,212,0.3)] border border-cyan-500/15",
        bubbleReceived: "bg-blue-950/35 backdrop-blur-md text-cyan-100 rounded-bl-sm border border-cyan-500/20 shadow-[0_4px_15px_rgba(6,182,212,0.08)]",
        accentColor: "cyan"
    },
    rose: {
        id: "rose",
        name: "Candy Rose",
        background: "linear-gradient(135deg, #3b1625 0%, #1a0813 100%)",
        previewBg: "linear-gradient(135deg, #3b1625, #1a0813)",
        bubbleSent: "bg-gradient-to-br from-rose-500 via-pink-500 to-rose-600 text-white rounded-br-sm shadow-[0_4px_15px_rgba(244,63,94,0.3)] border border-rose-500/25",
        bubbleReceived: "bg-rose-950/35 backdrop-blur-md text-rose-100 rounded-bl-sm border border-rose-500/20 shadow-[0_4px_15px_rgba(244,63,94,0.08)]",
        accentColor: "rose"
    }
};

export function getChatTheme(chatSettings, activeChat) {
    if (!activeChat || !chatSettings || !Array.isArray(chatSettings)) return chatThemes.default;

    // Find settings for activeChat
    const settings = chatSettings.find(s => 
        activeChat.isGroup 
            ? (s.groupId && s.groupId.toString() === activeChat._id.toString())
            : (s.peerId && s.peerId.toString() === activeChat._id.toString())
    );

    if (!settings) return chatThemes.default;

    const themeKey = settings.theme || "default";
    const selectedTheme = chatThemes[themeKey] || chatThemes.default;

    // If there is a custom background, we override the background property
    if (settings.customBackground) {
        return {
            ...selectedTheme,
            background: `url(${settings.customBackground})`,
            isCustomImage: true
        };
    }

    return selectedTheme;
}
