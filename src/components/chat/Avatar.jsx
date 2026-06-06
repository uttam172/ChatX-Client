import React from "react";

export default function Avatar({ user, className = "w-10 h-10", alt = "", ...props }) {
    if (!user) {
        return (
            <div 
                className={`${className} rounded-full bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs shrink-0 border border-border shadow-xs`}
                {...props}
            >
                ?
            </div>
        );
    }

    // Determine target URL/source
    let src = "";

    if (user.isGroup) {
        if (user.profilePicture) {
            src = user.profilePicture;
        } else if (user.avatarSeed && user.avatarStyle && user.avatarStyle !== "initials") {
            src = `https://api.dicebear.com/7.x/${user.avatarStyle}/svg?seed=${encodeURIComponent(user.avatarSeed)}&radius=50&backgroundType=gradientLinear`;
        } else {
            // For groups, generate a beautiful Initials avatar based on group name
            src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name || "Group")}&radius=50&backgroundType=gradientLinear`;
        }
    } else {
        if (user.profilePicture) {
            // Can be Cloudinary URL or Base64 data string
            src = user.profilePicture;
        } else if (user.avatarSeed && user.avatarStyle) {
            // Selected customized DiceBear style
            src = `https://api.dicebear.com/7.x/${user.avatarStyle}/svg?seed=${encodeURIComponent(user.avatarSeed)}&radius=50&backgroundType=gradientLinear`;
        } else {
            // Fallback to initials based on hikeId
            const seed = user.hikeId || "User";
            src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&radius=50&backgroundType=gradientLinear`;
        }
    }

    // Safe error fallback
    const handleError = (e) => {
        const fallbackSeed = user.isGroup ? (user.name || "Group") : (user.hikeId || "User");
        e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fallbackSeed)}&radius=50&backgroundType=gradientLinear`;
    };

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={src}
            alt={alt || (user.isGroup ? user.name : user.hikeId) || "avatar"}
            className={`${className} rounded-full object-cover border border-border shadow-xs shrink-0 transition-all duration-300`}
            onError={handleError}
            {...props}
        />
    );
}
