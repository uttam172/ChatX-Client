import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { X, Search, Check, Edit2, Copy, Shield, Users, User, Clock, Mail, Info } from "lucide-react";
import { isSameId } from "@/utils/chatHelpers";
import { chatThemes } from "@/utils/themeHelper";
import Avatar from "../Avatar";

export default function ChatDetailsModal({
    activeChat,
    currentUser,
    allUsers,
    onlineStatuses,
    formatLastSeenText,
    isOpen,
    onClose,
    onUpdateGroup,
    onUpdateTheme,
    chatSettings
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [groupName, setGroupName] = useState(() => activeChat?.isGroup ? (activeChat.name || "") : "");
    const [selectedUsers, setSelectedUsers] = useState(() => activeChat?.isGroup ? (activeChat.members || []).map(m => m._id) : []);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);

    const isAdmin = activeChat?.isGroup && isSameId(activeChat.createdBy, currentUser);

    const currentSetting = useMemo(() => {
        if (!activeChat || activeChat.isGroup) return null;
        return chatSettings?.find(s => s.peerId?.toString() === activeChat._id.toString());
    }, [chatSettings, activeChat]);

    const activeThemeId = currentSetting?.theme || "default";

    const handleWallpaperUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            alert("File must be an image");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Data = event.target.result;
            onUpdateTheme(activeChat._id, false, undefined, base64Data);
        };
        reader.readAsDataURL(file);
    };

    const filteredUsers = useMemo(() => {
        if (!searchQuery.trim()) return allUsers;
        const query = searchQuery.toLowerCase().replace(/^@/, '');
        return allUsers.filter(u => 
            u.hikeId.toLowerCase().includes(query)
        );
    }, [allUsers, searchQuery]);

    const handleToggleUser = (userId) => {
        // Creator/admin must always remain in the group
        if (isSameId(userId, activeChat.createdBy)) return;

        setSelectedUsers(prev => 
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
        setError("");
    };

    const handleCopyPublicKey = () => {
        if (!activeChat?.publicKey) return;
        navigator.clipboard.writeText(activeChat.publicKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSaveGroup = async (e) => {
        e.preventDefault();
        if (!groupName.trim()) {
            setError("Group name cannot be empty");
            return;
        }
        if (selectedUsers.length === 0) {
            setError("Select at least 1 group member");
            return;
        }

        setIsSaving(true);
        setError("");

        try {
            await onUpdateGroup(activeChat._id, groupName.trim(), selectedUsers);
            setIsEditing(false);
        } catch (err) {
            setError(err.message || "Failed to update group details");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !activeChat) return null;

    // ── 1-on-1 User Details View ──────────────────────────────
    if (!activeChat.isGroup) {
        const userStatus = onlineStatuses[activeChat._id];
        const isOnline = userStatus?.isOnline;
        const lastSeen = userStatus?.lastSeen;

        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ type: "spring", duration: 0.4 }}
                    className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
                >
                    {/* Header */}
                    <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
                        <div className="flex items-center gap-2">
                            <User className="w-5 h-5 text-indigo-500" />
                            <h3 className="font-bold text-lg text-foreground">User Details</h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 flex flex-col items-center gap-5 max-h-[70vh] overflow-y-auto">
                        {/* Avatar */}
                        <div className="relative">
                            <Avatar user={activeChat} className="w-20 h-20 shadow-md" />
                            {isOnline && (
                                <span className="absolute bottom-0 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-card" />
                            )}
                        </div>

                        {/* Basic Info */}
                        <div className="text-center">
                            <h4 className="text-xl font-bold text-foreground">@{activeChat.hikeId}</h4>
                            <div className="flex items-center justify-center gap-1.5 mt-2">
                                {isOnline ? (
                                    <span className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
                                        Active now
                                    </span>
                                ) : (
                                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        {formatLastSeenText(lastSeen)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Detailed Fields */}
                        <div className="w-full space-y-3.5 border-t border-border pt-4">
                            {activeChat.email && (
                                <div className="flex items-center gap-3 text-sm text-foreground">
                                    <Mail className="w-4.5 h-4.5 text-muted-foreground shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-none mb-1">Email</p>
                                        <p className="truncate font-medium">{activeChat.email}</p>
                                    </div>
                                </div>
                            )}

                            {activeChat.publicKey && (
                                <div className="flex items-start gap-3 text-sm text-foreground">
                                    <Shield className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-none mb-1">E2EE Public Key</p>
                                        <p className="text-xs font-mono break-all line-clamp-2 bg-muted p-2 rounded-lg border border-border/60">
                                            {activeChat.publicKey}
                                        </p>
                                        <button
                                            onClick={handleCopyPublicKey}
                                            className="mt-1.5 px-2.5 py-1 text-[11px] font-bold bg-muted hover:bg-muted-foreground/10 border border-border text-foreground hover:text-indigo-500 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                                        >
                                            {copied ? (
                                                <>
                                                    <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" />
                                                    Copied Key
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3.5 h-3.5" />
                                                    Copy Key
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Theme & Wallpaper Customization */}
                        <div className="w-full space-y-3 border-t border-border pt-4">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                                Chat Theme & Wallpaper
                            </label>
                            
                            {/* Preinstalled Themes Grid */}
                            <div className="grid grid-cols-3 gap-2">
                                {Object.values(chatThemes).map((themeObj) => {
                                    const isSelected = activeThemeId === themeObj.id && !currentSetting?.customBackground;
                                    return (
                                        <button
                                            key={themeObj.id}
                                            type="button"
                                            onClick={() => onUpdateTheme(activeChat._id, false, themeObj.id, "")}
                                            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer ${
                                                isSelected 
                                                    ? "border-indigo-500 ring-2 ring-indigo-500/20 scale-[1.02]" 
                                                    : "border-border/60"
                                            }`}
                                        >
                                            <div 
                                                className="w-8 h-8 rounded-full border border-border/50 shadow-inner"
                                                style={{ background: themeObj.previewBg || themeObj.background }}
                                            />
                                            <span className="text-[10px] font-bold text-foreground truncate w-full text-center">
                                                {themeObj.name.split(" ")[0]}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Custom Background Upload Button */}
                            <div className="flex flex-col gap-2 pt-1 w-full">
                                <div className="flex gap-2 w-full">
                                    <button
                                        type="button"
                                        onClick={() => document.getElementById("wallpaper-upload-dm")?.click()}
                                        className="flex-1 py-2 bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/20 hover:border-indigo-600 text-indigo-500 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        📷 Upload Wallpaper
                                    </button>
                                    {currentSetting?.customBackground && (
                                        <button
                                            type="button"
                                            onClick={() => onUpdateTheme(activeChat._id, false, "default", "")}
                                            className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 hover:border-rose-500 text-rose-500 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                                            title="Remove custom wallpaper"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                                <input
                                    id="wallpaper-upload-dm"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleWallpaperUpload}
                                    className="hidden"
                                />
                                {currentSetting?.customBackground && (
                                    <span className="text-[10px] text-emerald-500 font-bold text-center block">
                                        ✨ Custom wallpaper active
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Footer Info */}
                        <div className="w-full flex items-center gap-2 bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-3 text-xs text-indigo-500/80 font-medium">
                            <Info className="w-4.5 h-4.5 shrink-0" />
                            <span>Your conversations with @{activeChat.hikeId} are fully secured with end-to-end encryption.</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    // ── Group Details View ────────────────────────────────────
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: "spring", duration: 0.4 }}
                className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col h-[600px]"
            >
                {/* Modal Header */}
                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-500" />
                        <h3 className="font-bold text-lg text-foreground">
                            {isEditing ? "Edit Group Details" : "Group Details"}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        disabled={isSaving}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {isEditing ? (
                        /* Edit Form */
                        <form onSubmit={handleSaveGroup} className="flex-1 flex flex-col overflow-hidden p-5 space-y-4">
                            {/* Group Name input */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Group Name
                                </label>
                                <input
                                    type="text"
                                    placeholder="Enter group name..."
                                    value={groupName}
                                    onChange={(e) => {
                                        setGroupName(e.target.value);
                                        setError("");
                                    }}
                                    className="w-full px-3 py-2 rounded-xl bg-muted text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                                    maxLength={40}
                                    disabled={isSaving}
                                    required
                                />
                            </div>

                            {/* Member checklist */}
                            <div className="flex-1 flex flex-col overflow-hidden space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Members ({selectedUsers.length})
                                    </label>
                                </div>

                                {/* Search members */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Search users to add..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                        disabled={isSaving}
                                    />
                                </div>

                                {/* Users List Container */}
                                <div className="flex-1 overflow-y-auto border border-border rounded-xl bg-muted/20 p-2 space-y-1">
                                    {filteredUsers.length > 0 ? (
                                        filteredUsers.map((user) => {
                                            const isSelected = selectedUsers.includes(user._id);
                                            const isCreator = isSameId(user._id, activeChat.createdBy);
                                            return (
                                                <div
                                                    key={user._id}
                                                    onClick={() => !isCreator && handleToggleUser(user._id)}
                                                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all hover:bg-muted ${
                                                        isSelected ? "bg-indigo-500/10 border-l-4 border-indigo-600 pl-1" : ""
                                                    } ${isCreator ? "opacity-60 cursor-not-allowed" : ""}`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <Avatar user={user} className="w-8 h-8" />
                                                        <span className="text-sm font-medium text-foreground truncate">
                                                            {user.hikeId} {isCreator && <span className="text-[10px] bg-indigo-500 text-white font-bold px-1.5 py-0.5 rounded-full ml-1 uppercase">Admin</span>}
                                                        </span>
                                                    </div>
                                                    {!isCreator && (
                                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                                            isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-border bg-card"
                                                        }`}>
                                                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-center text-xs text-muted-foreground py-8">
                                            No users found
                                        </div>
                                    )}
                                </div>
                            </div>

                            {error && (
                                <p className="text-xs font-semibold text-rose-500">
                                    ⚠️ {error}
                                </p>
                            )}

                            {/* Modal Footer Buttons */}
                            <div className="pt-3 border-t border-border flex justify-end gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditing(false);
                                        setGroupName(activeChat.name || "");
                                        setSelectedUsers((activeChat.members || []).map(m => m._id));
                                        setError("");
                                    }}
                                    className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                                    disabled={isSaving}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving || !groupName.trim() || selectedUsers.length === 0}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer"
                                >
                                    {isSaving ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    ) : (
                        /* Read-only details view */
                        <div className="flex-1 flex flex-col overflow-hidden p-6 space-y-6">
                            {/* Avatar and Group Name */}
                            <div className="flex flex-col items-center gap-3">
                                <Avatar user={activeChat} className="w-20 h-20 shadow-md" />
                                <div className="text-center">
                                    <h4 className="text-xl font-bold text-foreground">{activeChat.name}</h4>
                                    <p className="text-xs text-muted-foreground mt-1">Group • {activeChat.members?.length || 0} members</p>
                                </div>
                                {isAdmin && (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="mt-1 px-3.5 py-1.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-500 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer border border-indigo-500/20 hover:border-indigo-600"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                        Edit Group details
                                    </button>
                                )}
                            </div>

                            {/* Members list */}
                            <div className="flex-1 flex flex-col overflow-hidden space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Group Members
                                </label>
                                <div className="flex-1 overflow-y-auto border border-border rounded-xl bg-muted/20 p-2.5 space-y-1">
                                    {activeChat.members?.map((member) => {
                                        const isCreator = isSameId(member._id, activeChat.createdBy);
                                        return (
                                            <div
                                                key={member._id}
                                                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <Avatar user={member} className="w-8 h-8" />
                                                    <span className="text-sm font-medium text-foreground truncate">
                                                        {member.hikeId}
                                                    </span>
                                                </div>
                                                {isCreator ? (
                                                    <span className="text-[9px] bg-indigo-500/10 text-indigo-500 font-bold border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase shrink-0">
                                                        Admin
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full uppercase shrink-0 font-medium">
                                                        Member
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Info Banner */}
                            <div className="w-full flex items-center gap-2 bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-3 text-xs text-indigo-500/80 font-medium">
                                <Info className="w-4.5 h-4.5 shrink-0" />
                                <span>Group messages are end-to-end encrypted using a client-side hybrid AES-RSA scheme.</span>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
