export const getCleanId = (val) => {
    if (!val) return "";
    if (typeof val === "string") return val.trim().toLowerCase();
    if (typeof val === "object") {
        const rawVal = val._id || val.id || val;
        return (rawVal ? rawVal.toString() : "").trim().toLowerCase();
    }
    return val.toString().trim().toLowerCase();
};

export const isSameId = (id1, id2) => {
    return getCleanId(id1) === getCleanId(id2);
};

export const getEmojiOnlyCount = (str) => {
    if (!str) return 0;
    const cleanStr = str.trim();
    if (!cleanStr) return 0;

    // Use Intl.Segmenter to accurately segment visual characters (handles skins, compound, ZWJs)
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        try {
            const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
            const segments = [...segmenter.segment(cleanStr)];
            
            let count = 0;
            for (const segment of segments) {
                const char = segment.segment.trim();
                if (!char) continue; // Allow/ignore whitespace between emojis
                
                // Match visual emoji character
                const isEmoji = /\p{Extended_Pictographic}/u.test(char) || 
                                /^\p{Emoji_Presentation}$/u.test(char) ||
                                /^[\u2600-\u27BF]$/u.test(char);
                                
                if (!isEmoji) return 0; // Contains non-emoji character
                count++;
            }
            return count;
        } catch (e) {
            console.warn("Intl.Segmenter error, falling back to regex: ", e);
        }
    }

    // Fallback regex if Intl.Segmenter is not supported or errors
    const emojiRegex = /(\p{Extended_Pictographic}|\p{Emoji_Presentation})/gu;
    const matches = cleanStr.match(emojiRegex);
    if (!matches) return 0;

    // Remove all matched emojis, variation selectors, and spaces
    const nonEmoji = cleanStr
        .replace(emojiRegex, '')
        .replace(/[\uFE0F\u200D\u200B\uFE0E]/g, '')
        .replace(/\s/g, '');

    if (nonEmoji.length > 0) return 0; // Contains non-emoji characters

    return matches.length;
};

export const formatLastSeenText = (lastSeen) => {
    if (!lastSeen) return "Offline";
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) {
        return "Active just now";
    } else if (diffMins < 60) {
        return `Active ${diffMins}m ago`;
    } else if (diffHours < 24) {
        return `Active ${diffHours}h ago`;
    } else {
        const days = Math.floor(diffHours / 24);
        if (days === 1) return "Active yesterday";
        return `Active ${days}d ago`;
    }
};

export const formatMessageTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1 || (diffDays === 2 && now.getDate() !== date.getDate())) {
        return "Yesterday";
    } else if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: "long" });
    } else {
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
};

export const formatDividerDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
        return "Today";
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return "Yesterday";
    }

    return date.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });
};

export const formatBubbleTime = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
