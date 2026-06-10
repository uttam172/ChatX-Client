export const chatThemes = {
    default: {
        id: "default",
        name: "Default",
        background: "linear-gradient(135deg, var(--color-background), var(--color-muted))",
        previewBg: "linear-gradient(135deg, #0b0f19, #1a2035)",
        bubbleSent: "bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-600 text-white rounded-br-sm shadow-[0_4px_15px_rgba(99,102,241,0.2)]",
        bubbleReceived: "bg-slate-900/35 backdrop-blur-md text-foreground rounded-bl-sm border border-slate-800/80 shadow-[0_4px_15px_rgba(0,0,0,0.15)]",
        accentColor: "indigo"
    },
    cosmic: {
        id: "cosmic",
        name: "Cosmic Space",
        background: "url('https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?q=80&w=1000&auto=format&fit=crop')",
        previewBg: "url('https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?q=80&w=1000&auto=format&fit=crop')",
        bubbleSent: "bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-600 text-white rounded-br-sm shadow-[0_4px_15px_rgba(99,102,241,0.2)]",
        bubbleReceived: "bg-slate-900/35 backdrop-blur-md text-foreground rounded-bl-sm border border-slate-800/80 shadow-[0_4px_15px_rgba(0,0,0,0.15)]",
        accentColor: "indigo"
    },
    cyberpunk: {
        id: "cyberpunk",
        name: "Cyberpunk Neon",
        background: "url('https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1000&auto=format&fit=crop')",
        previewBg: "url('https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1000&auto=format&fit=crop')",
        bubbleSent: "bg-gradient-to-br from-fuchsia-600 via-pink-600 to-rose-600 text-white rounded-br-sm shadow-[0_4px_15px_rgba(219,39,119,0.3)] border border-pink-500/20",
        bubbleReceived: "bg-purple-950/45 backdrop-blur-md text-fuchsia-100 rounded-bl-sm border border-pink-500/30 shadow-[0_4px_15px_rgba(219,39,119,0.1)]",
        accentColor: "pink"
    },
    sunset: {
        id: "sunset",
        name: "Warm Sunset",
        background: "url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop')",
        previewBg: "url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop')",
        bubbleSent: "bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600 text-white rounded-br-sm shadow-[0_4px_15px_rgba(249,115,22,0.3)] border border-orange-500/10",
        bubbleReceived: "bg-amber-950/35 backdrop-blur-md text-amber-100 rounded-bl-sm border border-amber-500/20 shadow-[0_4px_15px_rgba(249,115,22,0.08)]",
        accentColor: "orange"
    },
    emerald: {
        id: "emerald",
        name: "Emerald Garden",
        background: "url('https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?q=80&w=1000&auto=format&fit=crop')",
        previewBg: "url('https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?q=80&w=1000&auto=format&fit=crop')",
        bubbleSent: "bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 text-white rounded-br-sm shadow-[0_4px_15px_rgba(16,185,129,0.3)] border border-emerald-500/15",
        bubbleReceived: "bg-emerald-950/30 backdrop-blur-md text-emerald-100 rounded-bl-sm border border-emerald-500/20 shadow-[0_4px_15px_rgba(16,185,129,0.08)]",
        accentColor: "emerald"
    },
    midnight: {
        id: "midnight",
        name: "Midnight Ocean",
        background: "url('https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=1000&auto=format&fit=crop')",
        previewBg: "url('https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=1000&auto=format&fit=crop')",
        bubbleSent: "bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-600 text-white rounded-br-sm shadow-[0_4px_15px_rgba(6,182,212,0.3)] border border-cyan-500/15",
        bubbleReceived: "bg-blue-950/35 backdrop-blur-md text-cyan-100 rounded-bl-sm border border-cyan-500/20 shadow-[0_4px_15px_rgba(6,182,212,0.08)]",
        accentColor: "cyan"
    },
    rose: {
        id: "rose",
        name: "Candy Rose",
        background: "url('https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?q=80&w=1000&auto=format&fit=crop')",
        previewBg: "url('https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?q=80&w=1000&auto=format&fit=crop')",
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
