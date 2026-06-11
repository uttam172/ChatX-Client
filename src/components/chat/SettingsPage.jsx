import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
    User, 
    Shield, 
    Image as ImageIcon, 
    Copy, 
    Check, 
    Lock, 
    Loader2, 
    Camera,
    Info,
    CheckCircle2,
    ChevronLeft,
    Palette,
    Sun,
    Moon,
    Monitor
} from "lucide-react";
import { getPrivateKey, storePrivateKey } from "@/utils/crypto";
import { useTheme } from "next-themes";
import Avatar from "./Avatar";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const AVATAR_STYLES = [
    { value: "avataaars", label: "Avataaars" },
    { value: "bottts", label: "Robots" },
    { value: "pixel-art", label: "Pixels" },
    { value: "lorelei", label: "Cute Faces" },
    { value: "adventurer", label: "RPG Heroes" },
    { value: "croodles", label: "Doodles" },
    { value: "big-smile", label: "Cartoons" },
    { value: "shapes", label: "Shapes" },
    { value: "thumbs", label: "Gradients" }
];

export default function SettingsPage({
    currentUser,
    setCurrentUser,
    hasPrivateKey,
    handleRestorePrivateKey,
    handleRegenerateKeys,
    onClose,
    socket
}) {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setTimeout(() => {
            setMounted(true);
        }, 0);
    }, []);

    const handleThemeChange = (newTheme, event) => {
        const isAppearanceTransition =
            typeof document !== "undefined" &&
            document.startViewTransition &&
            !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (!isAppearanceTransition) {
            if (typeof window !== "undefined") {
                document.documentElement.classList.add("theme-transitioning");
                document.body.classList.remove("theme-transition-active");
                // Trigger reflow to restart animation
                void document.body.offsetWidth;
                document.body.classList.add("theme-transition-active");
                
                setTimeout(() => {
                    document.body.classList.remove("theme-transition-active");
                    document.documentElement.classList.remove("theme-transitioning");
                }, 500);
            }
            setTheme(newTheme);
            return;
        }

        // Get coordinates from click event or center of screen
        const x = event ? event.clientX : window.innerWidth / 2;
        const y = event ? event.clientY : window.innerHeight / 2;
        const endRadius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
        );

        const transition = document.startViewTransition(() => {
            setTheme(newTheme);
        });

        transition.ready.then(() => {
            const clipPath = [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`
            ];
            document.documentElement.animate(
                {
                    clipPath: clipPath
                },
                {
                    duration: 500,
                    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
                    pseudoElement: "::view-transition-new(root)"
                }
            );
        });
    };

    const [hikeId, setHikeId] = useState(() => currentUser?.hikeId || "");
    const [email, setEmail] = useState(() => currentUser?.email || "");
    const [bio, setBio] = useState(() => currentUser?.bio || "Hey there! I am using ChatX.");

    // Avatar state
    const [avatarMode, setAvatarMode] = useState(() => {
        if (currentUser?.profilePicture) return "upload";
        if (currentUser?.avatarSeed && currentUser?.avatarStyle) return "dicebear";
        return "initials";
    });
    const [avatarStyle, setAvatarStyle] = useState(() => currentUser?.avatarStyle || "initials");
    const [avatarSeed, setAvatarSeed] = useState(() => currentUser?.avatarSeed || "");
    const [profilePicture, setProfilePicture] = useState(() => currentUser?.profilePicture || "");
    const [uploadingImage, setUploadingImage] = useState(false);
    const [avatarError, setAvatarError] = useState("");

    // Security PIN State
    const [newPin, setNewPin] = useState("");
    const [pinMessage, setPinMessage] = useState("");
    const [pinSuccess, setPinSuccess] = useState(false);
    const [copiedKey, setCopiedKey] = useState(false);

    // Save states
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileMessage, setProfileMessage] = useState("");
    const [profileSuccess, setProfileSuccess] = useState(false);

    // Account Management State
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [confirmHibernate, setConfirmHibernate] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [hibernating, setHibernating] = useState(false);
    const [accountError, setAccountError] = useState("");

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setSavingProfile(true);
        setProfileMessage("");
        
        try {
            const token = localStorage.getItem("token");
            const oldHikeId = currentUser.hikeId;
            const targetHikeId = hikeId.trim().startsWith('@') ? hikeId.trim().slice(1) : hikeId.trim();

            const res = await fetch(`${API_URL}/api/users/profile`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    hikeId: targetHikeId,
                    email: email.trim(),
                    bio: bio.trim()
                })
            });

            const data = await res.json();

            if (res.ok) {
                if (data.token) {
                    localStorage.setItem("token", data.token);
                }

                // E2EE Key Migration: If username changed, copy the private key to new username in IndexedDB
                if (targetHikeId !== oldHikeId) {
                    try {
                        const privateKey = await getPrivateKey(oldHikeId);
                        if (privateKey) {
                            await storePrivateKey(targetHikeId, privateKey);
                            console.log(`E2EE Private key migrated to @${targetHikeId}`);
                        }
                    } catch (err) {
                        console.error("IndexedDB key migration failed:", err);
                    }

                    if (socket) {
                        socket.emit("update_hike_id", targetHikeId);
                    }
                }

                const updatedUser = {
                    ...data.user,
                    _id: data.user._id || data.user.id
                };
                localStorage.setItem("user", JSON.stringify(updatedUser));
                setCurrentUser(updatedUser);

                setProfileSuccess(true);
                setProfileMessage("Profile updated successfully!");
                setTimeout(() => setProfileMessage(""), 4000);
            } else {
                setProfileSuccess(false);
                setProfileMessage(data.error || "Failed to update profile details.");
            }
        } catch {
            setProfileSuccess(false);
            setProfileMessage("Network error occurred.");
        } finally {
            setSavingProfile(false);
        }
    };

    const handleSaveAvatar = async (updates) => {
        setSavingProfile(true);
        setAvatarError("");
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_URL}/api/users/profile`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(updates)
            });

            const data = await res.json();
            if (res.ok) {
                const updatedUser = {
                    ...data.user,
                    _id: data.user._id || data.user.id
                };
                localStorage.setItem("user", JSON.stringify(updatedUser));
                setCurrentUser(updatedUser);
                setProfileSuccess(true);
                setProfileMessage("Avatar saved successfully!");
                setTimeout(() => setProfileMessage(""), 4000);
            } else {
                setAvatarError(data.error || "Failed to save avatar settings.");
            }
        } catch {
            setAvatarError("Connection error.");
        } finally {
            setSavingProfile(false);
        }
    };

    const handleSelectInitialsMode = () => {
        setAvatarMode("initials");
        handleSaveAvatar({
            profilePicture: "",
            avatarSeed: "",
            avatarStyle: "initials"
        });
    };

    const handleSelectDiceBearMode = () => {
        setAvatarMode("dicebear");
        const defaultStyle = avatarStyle === "initials" ? "avataaars" : avatarStyle;
        const defaultSeed = avatarSeed || hikeId || "seed";
        setAvatarStyle(defaultStyle);
        setAvatarSeed(defaultSeed);
        handleSaveAvatar({
            profilePicture: "",
            avatarStyle: defaultStyle,
            avatarSeed: defaultSeed
        });
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

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
            await handleSaveAvatar({
                profilePicture: uploadedUrl,
                avatarSeed: "",
                avatarStyle: "initials"
            });

        } catch (err) {
            console.error("Avatar upload failed:", err);
            setAvatarError(err.message || "Failed to process image.");
        } finally {
            setUploadingImage(false);
        }
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

    const handleSetPin = async (e) => {
        e.preventDefault();
        if (!newPin.trim()) return;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_URL}/api/auth/set-pin`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ pin: newPin })
            });

            const data = res.ok ? await res.json() : null;
            if (res.ok) {
                setPinSuccess(true);
                setPinMessage("Hidden vault PIN updated successfully!");
                setNewPin("");
                setTimeout(() => {
                    setPinMessage("");
                    setPinSuccess(false);
                }, 4000);
            } else {
                const errMsg = data?.error || "Failed to update PIN";
                setPinSuccess(false);
                setPinMessage(errMsg);
            }
        } catch {
            setPinSuccess(false);
            setPinMessage("Error updating PIN");
        }
    };

    const copyToClipboard = () => {
        if (!currentUser?.publicKey) return;
        navigator.clipboard.writeText(currentUser.publicKey);
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
    };

    const handleRandomizeSeed = () => {
        const adjectives = [
            "cosmic", "neon", "retro", "quantum", "stellar", "sonic", "alpha", "ghost", "cyber", "hyper",
            "magic", "funky", "happy", "pixel", "golden", "crypto", "shadow", "omega", "wizard", "ninja"
        ];
        const nouns = [
            "panda", "tiger", "rabbit", "sloth", "cat", "fox", "dragon", "koala", "phoenix", "avatar",
            "robot", "alien", "star", "hacker", "gamer", "coder", "pilot", "hero", "beast", "spirit"
        ];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const num = Math.floor(Math.random() * 899) + 100;
        const randomSeed = `${adj}-${noun}-${num}`;
        
        setAvatarSeed(randomSeed);
        handleSaveAvatar({
            profilePicture: "",
            avatarStyle,
            avatarSeed: randomSeed
        });
    };

    const handleHibernate = async () => {
        if (!confirmHibernate) {
            setConfirmHibernate(true);
            setTimeout(() => setConfirmHibernate(false), 5000);
            return;
        }

        setHibernating(true);
        setAccountError("");
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_URL}/api/users/hibernate`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (res.ok) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                window.location.href = "/auth";
            } else {
                const data = await res.json();
                setAccountError(data.error || "Failed to hibernate account.");
            }
        } catch {
            setAccountError("Network error occurred.");
        } finally {
            setHibernating(false);
            setConfirmHibernate(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!confirmDelete) {
            setConfirmDelete(true);
            setTimeout(() => setConfirmDelete(false), 5000);
            return;
        }

        setDeleting(true);
        setAccountError("");
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_URL}/api/users/delete-account`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (res.ok) {
                if (typeof window !== "undefined" && currentUser?.hikeId) {
                    try {
                        await storePrivateKey(currentUser.hikeId, "");
                    } catch (err) {
                        console.error("Failed to delete local private key from IndexedDB:", err);
                    }
                }
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                window.location.href = "/auth";
            } else {
                const data = await res.json();
                setAccountError(data.error || "Failed to delete account.");
            }
        } catch {
            setAccountError("Network error occurred.");
        } finally {
            setDeleting(false);
            setConfirmDelete(false);
        }
    };

    const currentAvatarPreviewData = {
        hikeId: hikeId || currentUser?.hikeId,
        profilePicture: avatarMode === "upload" ? profilePicture : "",
        avatarStyle: avatarMode === "dicebear" ? avatarStyle : "initials",
        avatarSeed: avatarMode === "dicebear" ? avatarSeed : ""
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
            
            {/* Header */}
            <header className="h-16 border-b border-border px-6 flex items-center justify-between shrink-0 bg-card/80 backdrop-blur-md z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mr-1 cursor-pointer"
                        title="Back to Chats"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h2 className="font-bold text-lg leading-tight text-foreground">Settings</h2>
                        <p className="text-[11px] text-muted-foreground">Manage profile, avatars, and security keys</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {profileMessage && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${
                                profileSuccess 
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                                    : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                            }`}
                        >
                            {profileSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
                            {profileMessage}
                        </motion.div>
                    )}
                </div>
            </header>

            {/* Scrollable Content (Single Page Layout) */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-background">
                <div className="w-full space-y-8">
                    
                    {/* SECTION 1: PROFILE DETAILS */}
                    <div className="space-y-6">
                        <motion.div 
                            animate={{
                                background: [
                                    "linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(245, 158, 11, 0.03) 50%, rgba(249, 115, 22, 0.08) 100%)",
                                    "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(249, 115, 22, 0.03) 50%, rgba(245, 158, 11, 0.08) 100%)",
                                    "linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(245, 158, 11, 0.03) 50%, rgba(249, 115, 22, 0.08) 100%)"
                                ],
                                borderColor: [
                                    "rgba(249, 115, 22, 0.15)",
                                    "rgba(245, 158, 11, 0.15)",
                                    "rgba(249, 115, 22, 0.15)"
                                ]
                            }}
                            transition={{
                                duration: 10,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className="border rounded-xl p-4 flex items-center gap-3.5 shadow-xs relative overflow-hidden"
                        >
                            <motion.div
                                animate={{ x: ["-100%", "250%"] }}
                                transition={{ duration: 6, repeat: Infinity, ease: "linear", repeatDelay: 4 }}
                                className="absolute inset-y-0 w-1/3 bg-linear-to-r from-transparent via-white/5 to-transparent skew-x-12 pointer-events-none"
                            />
                            <div className="p-2.5 rounded-lg bg-orange-500/10 text-orange-500 border border-orange-500/20 shrink-0">
                                <User className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground tracking-wide">Profile Details</h3>
                                <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">Edit your username, email, and biography.</p>
                            </div>
                        </motion.div>

                        {/* Preview Profile Card */}
                        <div className="p-2 flex items-center gap-4">
                            <Avatar user={currentAvatarPreviewData} className="w-16 h-16 border-2 border-indigo-500" />
                            <div>
                                <span className="text-xs font-semibold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 px-2 py-0.5 rounded-full">@{hikeId || "username"}</span>
                                <h4 className="font-bold text-foreground text-base mt-1">{email || "email@address.com"}</h4>
                                <p className="text-xs text-muted-foreground line-clamp-1 italic mt-0.5">&ldquo;{bio}&rdquo;</p>
                            </div>
                        </div>

                        <form onSubmit={handleSaveProfile} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Username (Hike ID)</label>
                                    <input
                                        type="text"
                                        value={hikeId}
                                        onChange={(e) => setHikeId(e.target.value.replace(/[^a-zA-Z0-9_@]/g, ""))}
                                        placeholder="Enter username"
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-muted text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium transition-all"
                                        disabled={savingProfile}
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Email Address</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter email address"
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-muted text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium transition-all"
                                        disabled={savingProfile}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Bio / Status Description</label>
                                <textarea
                                    rows={3}
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    placeholder="Write something about yourself..."
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium transition-all resize-none"
                                    disabled={savingProfile}
                                    maxLength={150}
                                />
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={savingProfile}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1.5 cursor-pointer"
                                >
                                    {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Save Profile Details
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* SECTION 2: AVATAR & APPEARANCE */}
                    <div className="space-y-6 pt-10 border-t border-border/40">
                        <motion.div 
                            animate={{
                                background: [
                                    "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(6, 182, 212, 0.03) 50%, rgba(59, 130, 246, 0.08) 100%)",
                                    "linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(59, 130, 246, 0.03) 50%, rgba(6, 182, 212, 0.08) 100%)",
                                    "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(6, 182, 212, 0.03) 50%, rgba(59, 130, 246, 0.08) 100%)"
                                ],
                                borderColor: [
                                    "rgba(59, 130, 246, 0.15)",
                                    "rgba(6, 182, 212, 0.15)",
                                    "rgba(59, 130, 246, 0.15)"
                                ]
                            }}
                            transition={{
                                duration: 10,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: 2
                            }}
                            className="border rounded-xl p-4 flex items-center gap-3.5 shadow-xs relative overflow-hidden"
                        >
                            <motion.div
                                animate={{ x: ["-100%", "250%"] }}
                                transition={{ duration: 6, repeat: Infinity, ease: "linear", repeatDelay: 4, delay: 2 }}
                                className="absolute inset-y-0 w-1/3 bg-linear-to-r from-transparent via-white/5 to-transparent skew-x-12 pointer-events-none"
                            />
                            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 shrink-0">
                                <ImageIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground tracking-wide">Avatar Customization</h3>
                                <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">Customize your look with photos or vector styles.</p>
                            </div>
                        </motion.div>

                        {/* Live Preview Display */}
                        <div className="flex flex-col md:flex-row items-center justify-center p-4 gap-6">
                            
                            {/* Avatar Icon and Name */}
                            <div className="flex flex-col items-center shrink-0 relative z-10 text-center">
                                <div className="relative">
                                    <Avatar user={currentAvatarPreviewData} className="w-20 h-20 border-2 border-indigo-500 shadow-md relative z-10" />
                                    {uploadingImage && (
                                        <div className="absolute inset-0 rounded-full bg-black/60 backdrop-blur-xs z-20 flex items-center justify-center text-white">
                                            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                                        </div>
                                    )}
                                </div>
                                <span className="text-xs font-bold text-foreground mt-2">@{hikeId || currentUser?.hikeId}</span>
                            </div>

                            {/* Side-by-Side Seed Key Customization (Only in DiceBear mode) */}
                            {avatarMode === "dicebear" && (
                                <div className="flex-1 w-full max-w-md space-y-2 relative z-10">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Avatar Seed Key</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={avatarSeed}
                                            onChange={(e) => setAvatarSeed(e.target.value)}
                                            placeholder="Seed value (e.g. name)"
                                            className="flex-1 px-3.5 py-2.5 rounded-xl bg-card border border-border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleRandomizeSeed}
                                            className="px-3 py-2 border border-border hover:bg-muted text-foreground rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
                                            title="Randomize Seed"
                                        >
                                            🎲 Random
                                        </button>
                                        <button
                                            onClick={() => handleSaveAvatar({
                                                profilePicture: "",
                                                avatarStyle,
                                                avatarSeed
                                            })}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
                                        >
                                            Save Seed
                                        </button>
                                    </div>
                                    <p className="text-[9px] text-muted-foreground leading-normal">
                                        Type a custom word or hit 🎲 Random next to your preview to randomize and generate a unique vector design!
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Choices Grid */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {/* Upload photo */}
                                <div 
                                    onClick={() => document.getElementById("avatar-file-input-pane").click()}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col items-center text-center justify-center gap-2 ${
                                        avatarMode === "upload" 
                                            ? "border-indigo-500 bg-indigo-500/5" 
                                            : "border-border bg-muted/20 hover:bg-muted/40"
                                    }`}
                                >
                                    <div className="w-9 h-9 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                                        <Camera className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold">Upload Custom Photo</h4>
                                        <p className="text-[9px] text-muted-foreground mt-0.5">JPEG/PNG up to 5MB</p>
                                    </div>
                                    <input
                                        type="file"
                                        id="avatar-file-input-pane"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        className="hidden"
                                        disabled={uploadingImage}
                                    />
                                </div>

                                {/* DiceBear */}
                                <div 
                                    onClick={handleSelectDiceBearMode}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col items-center text-center justify-center gap-2 ${
                                        avatarMode === "dicebear" 
                                            ? "border-indigo-500 bg-indigo-500/5" 
                                            : "border-border bg-muted/20 hover:bg-muted/40"
                                    }`}
                                >
                                    <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                                        <ImageIcon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold">Custom DiceBear SVG</h4>
                                        <p className="text-[9px] text-muted-foreground mt-0.5">Styled vector avatars</p>
                                    </div>
                                </div>

                                {/* Initials */}
                                <div 
                                    onClick={handleSelectInitialsMode}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col items-center text-center justify-center gap-2 ${
                                        avatarMode === "initials" 
                                            ? "border-indigo-500 bg-indigo-500/5" 
                                            : "border-border bg-muted/20 hover:bg-muted/40"
                                    }`}
                                >
                                    <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold">Default Initials</h4>
                                        <p className="text-[9px] text-muted-foreground mt-0.5">Initials fallback</p>
                                    </div>
                                </div>
                            </div>

                            {avatarError && (
                                <p className="text-xs font-semibold text-rose-500 bg-rose-500/5 border border-rose-500/20 p-2.5 rounded-lg flex items-center gap-1">
                                    <Info className="w-4 h-4" /> {avatarError}
                                </p>
                            )}

                             {/* DiceBear settings */}
                             {avatarMode === "dicebear" && (
                                 <div className="p-5 bg-muted/40 border border-border rounded-xl space-y-6">
                                     <h4 className="text-xs font-bold text-foreground">Configure DiceBear Vector</h4>
                                     
                                     {/* Style Library Preview Grid */}
                                     <div className="space-y-2.5">
                                         <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Select Avatar Style</label>
                                         <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-x-2.5 gap-y-5">
                                             {AVATAR_STYLES.map((style) => {
                                                 const isSelected = avatarStyle === style.value;
                                                 const previewUrl = `https://api.dicebear.com/7.x/${style.value}/svg?seed=${encodeURIComponent(avatarSeed || hikeId || "seed")}&radius=50&backgroundType=gradientLinear`;

                                                 return (
                                                      <motion.div
                                                          key={style.value}
                                                          whileHover={{ scale: 1.08 }}
                                                          whileTap={{ scale: 0.92 }}
                                                          onClick={() => {
                                                              setAvatarStyle(style.value);
                                                              handleSaveAvatar({
                                                                  profilePicture: "",
                                                                  avatarStyle: style.value,
                                                                  avatarSeed: avatarSeed || hikeId || "seed"
                                                              });
                                                          }}
                                                          className="cursor-pointer flex flex-col items-center gap-1.5 text-center"
                                                      >
                                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                                          <img
                                                              src={previewUrl}
                                                              alt={style.label}
                                                              className={`w-14 h-14 rounded-full object-cover transition-all duration-200 ${
                                                                  isSelected 
                                                                      ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-background scale-105" 
                                                                      : "border border-border hover:scale-105"
                                                              }`}
                                                          />
                                                          <span className={`text-[10px] font-bold leading-tight transition-colors ${
                                                              isSelected ? "text-indigo-500" : "text-muted-foreground"
                                                          }`}>{style.label}</span>
                                                      </motion.div>
                                                 );
                                             })}
                                         </div>
                                     </div>
                                 </div>
                             )}
                    </div>
                </div>

                {/* SECTION 3: THEME SELECTION */}
                    <div className="space-y-6 pt-10 border-t border-border/40">
                        <motion.div 
                            animate={{
                                background: [
                                    "linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(217, 70, 239, 0.03) 50%, rgba(139, 92, 246, 0.08) 100%)",
                                    "linear-gradient(135deg, rgba(217, 70, 239, 0.08) 0%, rgba(139, 92, 246, 0.03) 50%, rgba(217, 70, 239, 0.08) 100%)",
                                    "linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(217, 70, 239, 0.03) 50%, rgba(139, 92, 246, 0.08) 100%)"
                                ],
                                borderColor: [
                                    "rgba(139, 92, 246, 0.15)",
                                    "rgba(217, 70, 239, 0.15)",
                                    "rgba(139, 92, 246, 0.15)"
                                ]
                            }}
                            transition={{
                                duration: 10,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: 3
                            }}
                            className="border rounded-xl p-4 flex items-center gap-3.5 shadow-xs relative overflow-hidden"
                        >
                            <motion.div
                                animate={{ x: ["-100%", "250%"] }}
                                transition={{ duration: 6, repeat: Infinity, ease: "linear", repeatDelay: 4, delay: 3 }}
                                className="absolute inset-y-0 w-1/3 bg-linear-to-r from-transparent via-white/5 to-transparent skew-x-12 pointer-events-none"
                            />
                            <div className="p-2.5 rounded-lg bg-violet-500/10 text-violet-500 border border-violet-500/20 shrink-0">
                                <Palette className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground tracking-wide">Theme Selection</h3>
                                <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">Choose how ChatX looks on your device.</p>
                            </div>
                        </motion.div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* Light Theme Card */}
                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={(e) => handleThemeChange("light", e)}
                                className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-between text-center gap-4 bg-card ${
                                    (mounted ? theme : "system") === "light" 
                                        ? "border-violet-500 ring-2 ring-violet-500/15" 
                                        : "border-border hover:border-violet-500/40 hover:bg-muted/30"
                                }`}
                            >
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                                    (mounted ? theme : "system") === "light" ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground"
                                }`}>
                                    <Sun className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-foreground">Light Appearance</h4>
                                    <p className="text-[10px] text-muted-foreground mt-1">Clean and vibrant layout</p>
                                </div>
                                <div className="w-full h-8 rounded-lg bg-slate-50 border border-slate-100 p-1.5 flex gap-1.5 items-center justify-center">
                                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                                    <div className="h-1.5 w-10 rounded bg-slate-200" />
                                </div>
                            </motion.div>

                            {/* Dark Theme Card */}
                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={(e) => handleThemeChange("dark", e)}
                                className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-between text-center gap-4 bg-card ${
                                    (mounted ? theme : "system") === "dark" 
                                        ? "border-violet-500 ring-2 ring-violet-500/15" 
                                        : "border-border hover:border-violet-500/40 hover:bg-muted/30"
                                }`}
                            >
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                                    (mounted ? theme : "system") === "dark" ? "bg-violet-500/15 text-violet-500" : "bg-muted text-muted-foreground"
                                }`}>
                                    <Moon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-foreground">Dark Appearance</h4>
                                    <p className="text-[10px] text-muted-foreground mt-1">Comfortable in low light</p>
                                </div>
                                <div className="w-full h-8 rounded-lg bg-slate-900 border border-slate-800 p-1.5 flex gap-1.5 items-center justify-center">
                                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                                    <div className="h-1.5 w-10 rounded bg-slate-700" />
                                </div>
                            </motion.div>

                            {/* System Theme Card */}
                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={(e) => handleThemeChange("system", e)}
                                className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-between text-center gap-4 bg-card ${
                                    (mounted ? theme : "system") === "system" 
                                        ? "border-violet-500 ring-2 ring-violet-500/15" 
                                        : "border-border hover:border-violet-500/40 hover:bg-muted/30"
                                }`}
                            >
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                                    (mounted ? theme : "system") === "system" ? "bg-indigo-500/15 text-indigo-500" : "bg-muted text-muted-foreground"
                                }`}>
                                    <Monitor className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-foreground">System Default</h4>
                                    <p className="text-[10px] text-muted-foreground mt-1">Syncs with system settings</p>
                                </div>
                                <div className="w-full h-8 rounded-lg bg-linear-to-r from-slate-50 to-slate-900 p-1.5 flex gap-1.5 items-center justify-center">
                                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0 animate-pulse" />
                                    <div className="h-1.5 w-10 rounded bg-indigo-500/30" />
                                </div>
                            </motion.div>
                        </div>
                    </div>

                    {/* SECTION 3: SECURITY & KEYS */}
                    <div className="space-y-6 pt-10 border-t border-border/40">
                        <motion.div 
                            animate={{
                                background: [
                                    "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(20, 184, 166, 0.03) 50%, rgba(16, 185, 129, 0.08) 100%)",
                                    "linear-gradient(135deg, rgba(20, 184, 166, 0.08) 0%, rgba(16, 185, 129, 0.03) 50%, rgba(20, 184, 166, 0.08) 100%)",
                                    "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(20, 184, 166, 0.03) 50%, rgba(16, 185, 129, 0.08) 100%)"
                                ],
                                borderColor: [
                                    "rgba(16, 185, 129, 0.15)",
                                    "rgba(20, 184, 166, 0.15)",
                                    "rgba(16, 185, 129, 0.15)"
                                ]
                            }}
                            transition={{
                                duration: 10,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: 4
                            }}
                            className="border rounded-xl p-4 flex items-center gap-3.5 shadow-xs relative overflow-hidden"
                        >
                            <motion.div
                                animate={{ x: ["-100%", "250%"] }}
                                transition={{ duration: 6, repeat: Infinity, ease: "linear", repeatDelay: 4, delay: 4 }}
                                className="absolute inset-y-0 w-1/3 bg-linear-to-r from-transparent via-white/5 to-transparent skew-x-12 pointer-events-none"
                            />
                            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
                                <Shield className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground tracking-wide">Security & Keys</h3>
                                <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">Manage PIN code and E2EE encryption keys.</p>
                            </div>
                        </motion.div>

                        {/* PIN Code */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-1.5">
                                <Lock className="w-4 h-4 text-indigo-500" />
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Hidden Vault PIN
                                </h4>
                            </div>

                            <form onSubmit={handleSetPin} className="space-y-3 max-w-md">
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Update your 4-digit security PIN used to show or hide the secure messaging vault in the sidebar.
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        pattern="[0-9]*"
                                        inputMode="numeric"
                                        maxLength={4}
                                        placeholder="Enter 4-digit PIN"
                                        value={newPin}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9]/g, "");
                                            setNewPin(val);
                                        }}
                                        className="flex-1 px-3.5 py-2 rounded-xl bg-muted text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold transition-all"
                                    />
                                    <button
                                        type="submit"
                                        disabled={newPin.length !== 4}
                                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                                    >
                                        Update PIN
                                    </button>
                                </div>
                                {pinMessage && (
                                    <p className={`text-xs font-semibold ${pinSuccess ? "text-emerald-500" : "text-rose-500"}`}>
                                        {pinMessage}
                                    </p>
                                )}
                            </form>
                        </div>

                        {/* E2EE Public Key */}
                        {currentUser?.publicKey && (
                            <div className="space-y-2 pt-4 border-t border-border">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        E2EE Public Key
                                    </span>
                                    <button
                                        onClick={copyToClipboard}
                                        className="text-xs text-indigo-500 hover:text-indigo-400 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                    >
                                        {copiedKey ? (
                                            <>
                                                <Check className="w-3.5 h-3.5" /> Copied!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-3.5 h-3.5" /> Copy Key
                                            </>
                                        )}
                                    </button>
                                </div>
                                <div className="bg-muted border border-border rounded-xl p-3 font-mono text-[10px] break-all max-h-24 overflow-y-auto text-muted-foreground select-all leading-normal">
                                    {currentUser.publicKey}
                                </div>
                            </div>
                        )}

                        {/* E2EE Key Actions */}
                        <div className="pt-4 border-t border-border">
                            {!hasPrivateKey ? (
                                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-3">
                                    <p className="text-xs text-amber-500 font-bold leading-relaxed flex items-center gap-1.5">
                                        ⚠️ Private key missing from this browser!
                                    </p>
                                    <p className="text-xs text-muted-foreground leading-normal">
                                        You will not be able to decrypt past or future messages on this browser until you regenerate E2EE keys or restore keys from a backup.
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleRestorePrivateKey}
                                            className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                                        >
                                            Restore from Backup
                                        </button>
                                        <button
                                            onClick={handleRegenerateKeys}
                                            className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                                        >
                                            Regenerate Keys
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-3">
                                    <p className="text-xs text-emerald-500 font-bold leading-relaxed flex items-center gap-1.5">
                                        ✓ Secure E2EE Private Key Active
                                    </p>
                                    <p className="text-xs text-muted-foreground leading-normal">
                                        Your private key is safely stored in IndexedDB. If you are experiencing message decryption issues on this device, you can trigger a key reset.
                                    </p>
                                    <button
                                        onClick={handleRegenerateKeys}
                                        className="px-4 py-2 border border-indigo-500/20 hover:bg-indigo-500/10 text-indigo-500 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                                    >
                                        Regenerate E2EE Keys
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SECTION 5: ACCOUNT MANAGEMENT */}
                    <div className="space-y-6 pt-10 border-t border-border/40">
                        <motion.div 
                            animate={{
                                background: [
                                    "linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(244, 63, 94, 0.03) 50%, rgba(239, 68, 68, 0.08) 100%)",
                                    "linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(239, 68, 68, 0.03) 50%, rgba(244, 63, 94, 0.08) 100%)",
                                    "linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(244, 63, 94, 0.03) 50%, rgba(239, 68, 68, 0.08) 100%)"
                                ],
                                borderColor: [
                                    "rgba(239, 68, 68, 0.15)",
                                    "rgba(244, 63, 94, 0.15)",
                                    "rgba(239, 68, 68, 0.15)"
                                ]
                            }}
                            transition={{
                                duration: 10,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: 5
                            }}
                            className="border rounded-xl p-4 flex items-center gap-3.5 shadow-xs relative overflow-hidden"
                        >
                            <motion.div
                                animate={{ x: ["-100%", "250%"] }}
                                transition={{ duration: 6, repeat: Infinity, ease: "linear", repeatDelay: 4, delay: 5 }}
                                className="absolute inset-y-0 w-1/3 bg-linear-to-r from-transparent via-white/5 to-transparent skew-x-12 pointer-events-none"
                            />
                            <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 shrink-0">
                                <User className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground tracking-wide">Account Settings</h3>
                                <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">Temporarily disable or permanently delete your account.</p>
                            </div>
                        </motion.div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Hibernate Card */}
                            <div className="p-1 flex flex-col justify-between gap-4">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-bold text-foreground">Hibernate Profile</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Temporarily disable your account. In groups, you will show as &quot;Hibernating User&quot; with a default avatar. You will be logged out. Logging back in manually unhibernates your profile automatically.
                                    </p>
                                </div>
                                <button
                                    onClick={handleHibernate}
                                    disabled={hibernating}
                                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                        confirmHibernate
                                            ? "bg-amber-600 hover:bg-amber-700 text-white animate-pulse"
                                            : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/20"
                                    }`}
                                >
                                    {hibernating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    {confirmHibernate ? "Click again to confirm Hibernate" : "Hibernate Profile"}
                                </button>
                            </div>

                            {/* Delete Card */}
                            <div className="p-1 flex flex-col justify-between gap-4">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-bold text-rose-500">Delete Account</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Permanently delete your profile. This will remove you from all groups, delete all your direct and group messages, E2EE keys, and clear all your settings. This action is irreversible.
                                    </p>
                                </div>
                                <button
                                    onClick={handleDeleteAccount}
                                    disabled={deleting}
                                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                        confirmDelete
                                            ? "bg-rose-600 hover:bg-rose-700 text-white animate-pulse shadow-md shadow-rose-600/10"
                                            : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20"
                                    }`}
                                >
                                    {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    {confirmDelete ? "Click again to confirm DELETE" : "Delete Account"}
                                </button>
                            </div>
                        </div>

                        {accountError && (
                            <p className="text-xs font-semibold text-rose-500 bg-rose-500/5 border border-rose-500/20 p-2.5 rounded-lg flex items-center gap-1">
                                <Info className="w-4 h-4" /> {accountError}
                            </p>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
