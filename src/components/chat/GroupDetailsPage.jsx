import React, { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { 
    ChevronLeft, Users, Check, Search, Trash2, LogOut, Camera, 
    Loader2, Sparkles, Shield, Info, Plus
} from "lucide-react";
import { isSameId } from "@/utils/chatHelpers";
import Avatar from "./Avatar";
import AnimatedIcon from "../common/AnimatedIcon";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const dicebearStyles = [
    { name: "Avataaars (People)", value: "avataaars" },
    { name: "Bottts (Robots)", value: "bottts" },
    { name: "Pixel Art", value: "pixel-art" },
    { name: "Lorelei (Anime)", value: "lorelei" },
    { name: "Shapes (Abstract)", value: "shapes" },
    { name: "Big Smile", value: "big-smile" },
    { name: "Adventurer", value: "adventurer" },
    { name: "Fun Emoji", value: "fun-emoji" },
    { name: "Identicon (Geometric)", value: "identicon" }
];

export default function GroupDetailsPage({
    activeChat,
    currentUser,
    allUsers,
    onUpdateGroup,
    onClose,
    showConfirm
}) {
    const [groupName, setGroupName] = useState(() => activeChat?.name || "");
    const [selectedUsers, setSelectedUsers] = useState(() => (activeChat?.members || []).map(m => m._id));
    const [searchQuery, setSearchQuery] = useState("");
    
    // Avatar states
    const [avatarMode, setAvatarMode] = useState(() => {
        if (activeChat?.profilePicture) return "upload";
        return "dicebear";
    });
    const [avatarStyle, setAvatarStyle] = useState(() => {
        if (!activeChat?.profilePicture && activeChat?.avatarStyle) return activeChat.avatarStyle;
        return "initials";
    });
    const [avatarSeed, setAvatarSeed] = useState(() => {
        if (!activeChat?.profilePicture && activeChat?.avatarSeed) return activeChat.avatarSeed;
        return "";
    });
    const [profilePicture, setProfilePicture] = useState(() => activeChat?.profilePicture || "");
    
    // Status states
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState("");
    const [avatarError, setAvatarError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const fileInputRef = useRef(null);

    const isAdmin = activeChat && isSameId(activeChat.createdBy, currentUser);

    // Live avatar preview source
    const liveAvatarSrc = useMemo(() => {
        if (avatarMode === "upload" && profilePicture) {
            return profilePicture;
        }
        if (avatarMode === "dicebear" && avatarStyle !== "initials" && avatarSeed) {
            return `https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${encodeURIComponent(avatarSeed)}&radius=50&backgroundType=gradientLinear`;
        }
        return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(groupName || "Group")}&radius=50&backgroundType=gradientLinear`;
    }, [avatarMode, profilePicture, avatarStyle, avatarSeed, groupName]);

    // Filtered users for admin to add (exclude current group members and pending additions)
    const nonMembers = useMemo(() => {
        const query = searchQuery.toLowerCase().replace(/^@/, "");
        const persistedIds = (activeChat?.members || []).map(m => m._id);
        return allUsers.filter(u => 
            !selectedUsers.includes(u._id) && 
            !persistedIds.some(id => isSameId(id, u._id)) &&
            !isSameId(u._id, currentUser) &&
            (query ? u.hikeId.toLowerCase().includes(query) : true)
        );
    }, [allUsers, selectedUsers, activeChat, currentUser, searchQuery]);

    // Resolve current members details (already saved, not pending) from selectedUsers state
    const currentMembersDetails = useMemo(() => {
        const persistedMemberIds = (activeChat?.members || []).map(m => m._id);
        const remainingIds = selectedUsers.filter(id => persistedMemberIds.includes(id));

        return remainingIds.map(memberId => {
            const memberObj = (activeChat?.members || []).find(m => isSameId(m._id, memberId))
                || allUsers.find(u => isSameId(u._id, memberId))
                || (isSameId(currentUser, memberId) ? currentUser : null)
                || { _id: memberId, hikeId: "Loading..." };

            const isCreator = isSameId(memberId, activeChat?.createdBy);
            return {
                ...memberObj,
                isCreator
            };
        }).sort((a, b) => (b.isCreator ? 1 : 0) - (a.isCreator ? 1 : 0));
    }, [selectedUsers, activeChat, allUsers, currentUser]);

    // Resolve pending member additions
    const pendingAdditionsDetails = useMemo(() => {
        const persistedMemberIds = (activeChat?.members || []).map(m => m._id);
        const pendingIds = selectedUsers.filter(id => !persistedMemberIds.includes(id));

        return pendingIds.map(memberId => {
            const memberObj = allUsers.find(u => isSameId(u._id, memberId))
                || (isSameId(currentUser, memberId) ? currentUser : null)
                || { _id: memberId, hikeId: "Loading..." };
            return memberObj;
        });
    }, [selectedUsers, activeChat, allUsers, currentUser]);

    // Resolve pending member removals (persisted in database but removed in UI selection)
    const pendingRemovalsDetails = useMemo(() => {
        const persistedMembers = activeChat?.members || [];
        return persistedMembers.filter(member => !selectedUsers.includes(member._id))
            .map(member => {
                const isCreator = isSameId(member._id, activeChat?.createdBy);
                return {
                    ...member,
                    isCreator
                };
            });
    }, [selectedUsers, activeChat]);

    const handleRandomizeSeed = () => {
        const adjectives = ["Cool", "Epic", "Happy", "Secure", "Cyber", "Web", "Dev", "Pro", "Tech", "Elite", "Team", "Nexus"];
        const nouns = ["Squad", "Guild", "Hub", "Lab", "Net", "Base", "Room", "Chat", "Code", "Zone", "Flow", "Club"];
        const randAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const randNoun = nouns[Math.floor(Math.random() * nouns.length)];
        const randNumber = Math.floor(100 + Math.random() * 900);
        
        const newSeed = `${randAdjective}${randNoun}${randNumber}`;
        setAvatarSeed(newSeed);
        setAvatarError("");
    };

    const handleAvatarModeChange = (mode) => {
        setAvatarMode(mode);
        if (mode === "dicebear" && avatarStyle === "initials") {
            setAvatarStyle("avataaars");
            if (!avatarSeed) {
                handleRandomizeSeed();
            }
        }
        setAvatarError("");
    };

    const compressImageToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const MAX_WIDTH = 128;
                    const MAX_HEIGHT = 128;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);

                    const base64Url = canvas.toDataURL("image/jpeg", 0.7);
                    resolve(base64Url);
                };
                img.onerror = () => reject(new Error("Failed to load image for compression."));
            };
            reader.onerror = () => reject(new Error("Failed to read image file."));
        });
    };

    const handleUploadImage = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setAvatarError("File must be an image.");
            return;
        }

        setUploadingImage(true);
        setAvatarError("");

        try {
            const token = localStorage.getItem("token");
            
            const presignedRes = await fetch(`${API_URL}/api/media/presigned-url`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    fileName: file.name,
                    fileType: file.type || "image/jpeg",
                    fileSize: file.size
                })
            });

            let uploadedUrl = "";

            if (presignedRes.ok) {
                const { signature, timestamp, apiKey, cloudName, folder } = await presignedRes.json();
                const formData = new FormData();
                formData.append("file", file);
                formData.append("api_key", apiKey);
                formData.append("timestamp", timestamp);
                formData.append("signature", signature);
                formData.append("folder", folder);

                const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
                    method: "POST",
                    body: formData
                });

                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    uploadedUrl = uploadData.secure_url;
                }
            }

            if (!uploadedUrl) {
                uploadedUrl = await compressImageToBase64(file);
            }

            setAvatarMode("upload");
            setProfilePicture(uploadedUrl);
            setAvatarStyle("initials");
            setAvatarSeed("");
        } catch (err) {
            console.error("Avatar upload failed:", err);
            setAvatarError(err.message || "Failed to upload image.");
        } finally {
            setUploadingImage(false);
        }
    };

    const handleRemoveMember = (memberId) => {
        if (isSameId(memberId, activeChat.createdBy)) return;
        setSelectedUsers(prev => prev.filter(id => id !== memberId));
    };

    const handleAddMember = (memberId) => {
        if (selectedUsers.includes(memberId)) return;
        setSelectedUsers(prev => [...prev, memberId]);
    };

    const handleSaveGroup = async () => {
        if (!groupName.trim()) {
            setError("Group name cannot be empty");
            return;
        }
        if (selectedUsers.length === 0) {
            setError("Group must have at least one member");
            return;
        }

        setIsSaving(true);
        setError("");
        setSuccessMessage("");

        const picture = avatarMode === "upload" ? profilePicture : "";
        const seed = avatarMode === "dicebear" ? avatarSeed : "";
        const style = avatarMode === "dicebear" ? avatarStyle : "initials";

        try {
            await onUpdateGroup(activeChat._id, groupName.trim(), selectedUsers, picture, seed, style);
            setSuccessMessage("Group updated successfully!");
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (err) {
            setError(err.message || "Failed to save group details");
        } finally {
            setIsSaving(false);
        }
    };

    const handleLeaveGroup = async () => {
        const confirm = await showConfirm(
            "Leave Group",
            "Are you sure you want to leave this group? You will be removed from all member lists and will no longer see this chat conversation."
        );
        if (!confirm) return;

        setActionLoading(true);
        setError("");

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_URL}/api/groups/${activeChat._id}/leave`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to leave group.");
            }
        } catch (err) {
            setError(err.message || "Failed to leave group.");
            setActionLoading(false);
        }
    };

    const handleDeleteGroup = async () => {
        const confirm = await showConfirm(
            "Delete Group",
            "Are you sure you want to permanently delete this group? All direct and group messages, E2EE keys, and settings will be permanently deleted for all members. This action is irreversible."
        );
        if (!confirm) return;

        setActionLoading(true);
        setError("");

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_URL}/api/groups/${activeChat._id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to delete group.");
            }
        } catch (err) {
            setError(err.message || "Failed to delete group.");
            setActionLoading(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col overflow-y-auto bg-card/10 backdrop-blur-xs border border-border/30 rounded-3xl p-6 md:p-8 space-y-8 relative pr-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="p-2 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-full transition-colors cursor-pointer border border-border/50"
                        title="Back to Chat Room"
                        disabled={isSaving || actionLoading}
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-foreground tracking-tight">Group Details</h2>
                        <p className="text-xs text-muted-foreground mt-0.5 font-medium">Manage group info, avatars, and members.</p>
                    </div>
                </div>
            </div>

            {/* Error / Success Banners */}
            {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl text-xs font-semibold flex items-center gap-2">
                    <Info className="w-4.5 h-4.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}
            {successMessage && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl text-xs font-semibold flex items-center gap-2">
                    <Check className="w-4.5 h-4.5 shrink-0" />
                    <span>{successMessage}</span>
                </div>
            )}

            {/* SECTION 1: GROUP PROFILE PHOTO */}
            <div className="space-y-5">
                <motion.div 
                    animate={{
                        background: [
                            "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.03) 50%, rgba(99, 102, 241, 0.08) 100%)",
                            "linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(99, 102, 241, 0.03) 50%, rgba(139, 92, 246, 0.08) 100%)",
                            "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.03) 50%, rgba(99, 102, 241, 0.08) 100%)"
                        ],
                        borderColor: [
                            "rgba(99, 102, 241, 0.15)",
                            "rgba(139, 92, 246, 0.15)",
                            "rgba(99, 102, 241, 0.15)"
                        ]
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                    className="border rounded-2xl p-4 flex items-center gap-3.5 shadow-xs relative overflow-hidden"
                >
                    <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 shrink-0">
                        <Users className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-foreground tracking-wide">Group Identity</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                            {isAdmin ? "Customize your group's representation in sidebars and headers." : "View group profile avatar details."}
                        </p>
                    </div>
                </motion.div>

                <div className="flex flex-col lg:flex-row gap-6 items-start">
                    {/* Live Avatar Preview */}
                    <div className="flex flex-col items-center gap-3 shrink-0 mx-auto lg:mx-0">
                        <div className="relative group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={liveAvatarSrc}
                                alt="Group Live Avatar"
                                className="w-24 h-24 rounded-full object-cover border-2 border-indigo-500/30 shadow-md transition-all duration-300"
                            />
                            {isAdmin && (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[10px] font-bold gap-1"
                                >
                                    <Camera className="w-4.5 h-4.5" />
                                    Change Image
                                </button>
                            )}
                        </div>
                        {isAdmin && (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="text-xs text-indigo-500 hover:text-indigo-600 font-bold transition-colors cursor-pointer"
                                disabled={uploadingImage}
                            >
                                {uploadingImage ? "Uploading..." : "Upload Photo"}
                            </button>
                        )}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleUploadImage}
                            accept="image/*"
                            className="hidden"
                        />
                    </div>

                    {/* Avatar Controls (Admin only) */}
                    {isAdmin ? (
                        <div className="flex-1 w-full space-y-4">
                            <div className="flex gap-2.5 bg-muted/30 p-1 border border-border/50 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => handleAvatarModeChange("dicebear")}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                        avatarMode === "dicebear"
                                            ? "bg-card text-foreground shadow-xs"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    DiceBear Generator
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleAvatarModeChange("upload")}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                        avatarMode === "upload"
                                            ? "bg-card text-foreground shadow-xs"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    Custom Upload
                                </button>
                            </div>

                            {avatarMode === "dicebear" ? (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="flex gap-2">
                                        <div className="flex-1 relative">
                                            <Sparkles className="absolute left-3 top-2.5 w-4 h-4 text-indigo-500" />
                                            <input
                                                type="text"
                                                placeholder="Custom seed key..."
                                                value={avatarSeed}
                                                onChange={(e) => {
                                                    setAvatarSeed(e.target.value);
                                                    setAvatarError("");
                                                }}
                                                className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-semibold"
                                                maxLength={30}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleRandomizeSeed}
                                            className="px-3.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 border border-indigo-500/20 hover:border-indigo-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                                        >
                                            🎲 Random
                                        </button>
                                    </div>

                                    {/* DiceBear Style Grid */}
                                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-36 overflow-y-auto pr-1">
                                        {dicebearStyles.map((style) => {
                                            const isSelected = avatarStyle === style.value;
                                            const demoSrc = `https://api.dicebear.com/7.x/${style.value}/svg?seed=Avatar&radius=50`;
                                            return (
                                                <div
                                                    key={style.value}
                                                    onClick={() => {
                                                        setAvatarStyle(style.value);
                                                        setProfilePicture("");
                                                        setAvatarError("");
                                                    }}
                                                    className="flex flex-col items-center gap-1 cursor-pointer group"
                                                >
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={demoSrc}
                                                        alt={style.name}
                                                        className={`w-10 h-10 rounded-full bg-muted object-cover transition-all ${
                                                            isSelected
                                                                ? "ring-2 ring-indigo-500 ring-offset-2 scale-102"
                                                                : "group-hover:scale-102 opacity-70 group-hover:opacity-100"
                                                        }`}
                                                    />
                                                    <span className="text-[9px] font-semibold text-muted-foreground text-center line-clamp-1 leading-tight mt-0.5">
                                                        {style.name.split(" ")[0]}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 border border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-center gap-2 min-h-32 bg-muted/10 animate-fade-in">
                                    <Camera className="w-8 h-8 text-muted-foreground opacity-60 animate-pulse" />
                                    <div>
                                        <p className="text-xs font-bold text-foreground">Custom Upload Area</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">Click &quot;Upload Photo&quot; above to select a custom file.</p>
                                    </div>
                                </div>
                            )}

                            {avatarError && <p className="text-xs text-rose-500 font-medium">⚠️ {avatarError}</p>}
                        </div>
                    ) : (
                        <div className="flex-1 w-full flex flex-col justify-center gap-1 p-4 bg-muted/10 border border-border/45 rounded-2xl min-h-24">
                            <p className="text-xs text-foreground font-bold leading-normal">ReadOnly View Mode</p>
                            <p className="text-[11px] text-muted-foreground leading-normal">
                                Only the group administrator has permission to modify group avatars and styles.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* SECTION 2: GROUP NAME & SETTINGS */}
            <div className="space-y-4 border-t border-border/40 pt-8">
                <div className="space-y-1">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Group Name Settings</h3>
                </div>
                
                <div className="space-y-3.5">
                    {isAdmin ? (
                        <div className="space-y-1">
                            <input
                                type="text"
                                placeholder="Enter group name..."
                                value={groupName}
                                onChange={(e) => {
                                    setGroupName(e.target.value);
                                    setError("");
                                }}
                                className="w-full px-4 py-2.5 rounded-xl bg-muted text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold tracking-wide"
                                maxLength={40}
                                disabled={isSaving}
                                required
                            />
                        </div>
                    ) : (
                        <div className="p-4 bg-muted/40 border border-border rounded-xl">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Group Name</span>
                            <span className="text-sm font-bold text-foreground">{groupName}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* SECTION 3: MEMBERS MANAGEMENT */}
            <div className="space-y-4 border-t border-border/40 pt-8">
                <div className="space-y-1 flex items-center justify-between">
                    <div>
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Group Members ({selectedUsers.length})
                        </h3>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    {/* Current Members List */}
                    <div className="space-y-4 w-full flex flex-col">
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Current Members</label>
                            <div className="border border-border rounded-2xl bg-muted/10 p-3.5 space-y-1.5 max-h-60 overflow-y-auto">
                                {currentMembersDetails.length > 0 ? (
                                    currentMembersDetails.map((member) => {
                                        const isCreator = member.isCreator;
                                        return (
                                            <div
                                                key={member._id}
                                                className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <Avatar user={member} className="w-8 h-8" />
                                                    <span className="text-xs font-semibold text-foreground truncate">
                                                        @{member.hikeId}
                                                    </span>
                                                </div>
                                                {isCreator ? (
                                                    <span className="text-[9px] bg-indigo-500/10 text-indigo-500 font-bold border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase shrink-0">
                                                        Admin
                                                    </span>
                                                ) : isAdmin ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveMember(member._id)}
                                                        className="p-1 rounded-full text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer border border-transparent hover:border-rose-500/10"
                                                        title="Staged member removal"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                ) : (
                                                    <span className="text-[9px] bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full uppercase shrink-0 font-medium">
                                                        Member
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center text-[11px] text-muted-foreground py-6 font-medium">
                                        No members in group
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Pending Additions Section */}
                        {isAdmin && pendingAdditionsDetails.length > 0 && (
                            <div className="space-y-2 animate-fade-in">
                                <label className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Pending Additions ({pendingAdditionsDetails.length})
                                </label>
                                <div className="border border-emerald-500/20 rounded-2xl bg-emerald-500/5 p-3.5 space-y-1.5 max-h-48 overflow-y-auto">
                                    {pendingAdditionsDetails.map((member) => (
                                        <div
                                            key={member._id}
                                            className="flex items-center justify-between p-2 rounded-xl hover:bg-emerald-500/10 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <Avatar user={member} className="w-8 h-8" />
                                                <span className="text-xs font-semibold text-foreground truncate">
                                                    @{member.hikeId}
                                                </span>
                                                <span className="text-[9px] bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20 px-1.5 py-0.5 rounded-full uppercase shrink-0">
                                                    Pending
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveMember(member._id)}
                                                className="p-1 rounded-full text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer border border-transparent"
                                                title="Cancel addition"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Pending Removals Section */}
                        {isAdmin && pendingRemovalsDetails.length > 0 && (
                            <div className="space-y-2 animate-fade-in">
                                <label className="text-[11px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                    Pending Removals ({pendingRemovalsDetails.length})
                                </label>
                                <div className="border border-rose-500/20 rounded-2xl bg-rose-500/5 p-3.5 space-y-1.5 max-h-48 overflow-y-auto">
                                    {pendingRemovalsDetails.map((member) => (
                                        <div
                                            key={member._id}
                                            className="flex items-center justify-between p-2 rounded-xl hover:bg-rose-500/10 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <Avatar user={member} className="w-8 h-8" />
                                                <span className="text-xs font-semibold text-foreground truncate">
                                                    @{member.hikeId}
                                                </span>
                                                <span className="text-[9px] bg-rose-500/10 text-rose-500 font-bold border border-rose-500/20 px-1.5 py-0.5 rounded-full uppercase shrink-0">
                                                    Removing
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleAddMember(member._id)}
                                                className="p-1 rounded-full text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors cursor-pointer border border-transparent"
                                                title="Cancel removal"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Add New Members (Admin only) */}
                    {isAdmin ? (
                        <div className="space-y-2 w-full">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Add New Members</label>
                            
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search users to add..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-semibold"
                                />
                            </div>

                            <div className="border border-border rounded-2xl bg-muted/10 p-3.5 space-y-1.5 max-h-48 overflow-y-auto">
                                {nonMembers.length > 0 ? (
                                    nonMembers.map((user) => (
                                        <div
                                            key={user._id}
                                            className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <Avatar user={user} className="w-8 h-8" />
                                                <span className="text-xs font-semibold text-foreground truncate">
                                                    @{user.hikeId}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleAddMember(user._id)}
                                                className="p-1.5 rounded-full text-indigo-500 hover:bg-indigo-500/10 transition-colors cursor-pointer border border-transparent hover:border-indigo-500/10"
                                                title="Add to group"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center text-[11px] text-muted-foreground py-6 font-medium">
                                        No eligible users found
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2 flex flex-col justify-center bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4 self-stretch min-h-36">
                            <h4 className="text-xs font-bold text-indigo-500 flex items-center gap-1.5">
                                <Shield className="w-4 h-4" /> Security Shield Active
                            </h4>
                            <p className="text-[11px] text-muted-foreground leading-normal mt-1 font-medium">
                                Adding or removing members is restricted to group administrators. Group communication stays end-to-end encrypted for existing members.
                            </p>
                        </div>
                    )}
                </div>

                {/* Info Disclaimer */}
                <div className="flex items-start gap-2 bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-3 text-[10px] text-indigo-500/80 font-semibold">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Group updates trigger secure client-side key recalculations. All current members will be notified automatically.</span>
                </div>

                {/* Save Changes button (Admin only) */}
                {isAdmin && (
                    <div className="pt-2 flex justify-end">
                        <button
                            type="button"
                            onClick={handleSaveGroup}
                            disabled={isSaving || !groupName.trim() || selectedUsers.length === 0}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-indigo-600/10 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving Changes
                                </>
                            ) : (
                                "Save Changes"
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* SECTION 4: DANGER ZONE (Delete or Leave) */}
            <div className="space-y-4 border-t border-border/40 pt-8">
                <div className="space-y-1">
                    <h3 className="text-xs font-bold text-rose-500 uppercase tracking-wider">Danger Zone</h3>
                </div>

                <div className="p-1 flex flex-col gap-6">
                    {/* Leave Group (Shown to both Admin and normal members) */}
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <h4 className="text-xs font-bold text-foreground">Leave Group</h4>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                {isAdmin 
                                    ? "Exit from this group conversation. Since you are the group administrator, leaving the group will automatically promote one of the remaining members to become the new group admin. If no other members remain, the group will be permanently deleted."
                                    : "Exit from this group conversation. You will lose access to future messages and this group chat will be completely removed from your conversation list."}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleLeaveGroup}
                            disabled={actionLoading || isSaving}
                            className="w-full py-2.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                        >
                            {actionLoading ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Leaving...
                                </>
                            ) : (
                                <>
                                    <AnimatedIcon name="LogOut" animation="logout" size={16} /> Leave Group
                                </>
                            )}
                        </button>
                    </div>

                    {/* Delete Group (Admin only) */}
                    {isAdmin && (
                        <div className="space-y-3 pt-4 border-t border-border/20">
                            <div className="space-y-1.5">
                                <h4 className="text-xs font-bold text-foreground">Delete Group</h4>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    Permanently destroy this group. This will delete the group document, remove all members, and wipe out all message histories and encryption keys. This action cannot be undone.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleDeleteGroup}
                                disabled={actionLoading || isSaving}
                                className="w-full py-2.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                            >
                                {actionLoading ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting...
                                    </>
                                ) : (
                                    <>
                                        <AnimatedIcon name="Trash2" animation="shake" size={16} /> Delete Group
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
