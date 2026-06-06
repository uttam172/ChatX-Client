import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Users, X, Search, Check } from "lucide-react";
import Avatar from "../Avatar";
export default function CreateGroupModal({
    allUsers,
    isOpen,
    onClose,
    onCreateGroup
}) {
    const [groupName, setGroupName] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState("");

    const filteredUsers = useMemo(() => {
        if (!searchQuery.trim()) return allUsers;
        const query = searchQuery.toLowerCase().replace(/^@/, '');
        return allUsers.filter(u => 
            u.hikeId.toLowerCase().includes(query)
        );
    }, [allUsers, searchQuery]);

    const handleToggleUser = (userId) => {
        setSelectedUsers(prev => 
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
        setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!groupName.trim()) {
            setError("Group name is required");
            return;
        }
        if (selectedUsers.length === 0) {
            setError("Select at least 1 group member");
            return;
        }

        setIsCreating(true);
        setError("");

        try {
            await onCreateGroup(groupName.trim(), selectedUsers);
            setGroupName("");
            setSelectedUsers([]);
            onClose();
        } catch (err) {
            setError(err.message || "Failed to create group");
        } finally {
            setIsCreating(false);
        }
    };

    if (!isOpen) return null;

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
                        <h3 className="font-bold text-lg text-foreground">Create Group</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden p-5 space-y-4">
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
                            className="w-full px-3 py-2 rounded-xl bg-muted text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            maxLength={40}
                            disabled={isCreating}
                            required
                        />
                    </div>

                    {/* Member checklist */}
                    <div className="flex-1 flex flex-col overflow-hidden space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Select Members ({selectedUsers.length})
                            </label>
                        </div>

                        {/* Search members */}
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search users by Hike ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                disabled={isCreating}
                            />
                        </div>

                        {/* Users List Container */}
                        <div className="flex-1 overflow-y-auto border border-border rounded-xl bg-muted/20 p-2 space-y-1">
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map((user) => {
                                    const isSelected = selectedUsers.includes(user._id);
                                    return (
                                        <div
                                            key={user._id}
                                            onClick={() => handleToggleUser(user._id)}
                                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all hover:bg-muted ${
                                                isSelected ? "bg-indigo-500/10 border-l-4 border-indigo-600 pl-1" : ""
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <Avatar user={user} className="w-8 h-8" />
                                                <span className="text-sm font-medium text-foreground truncate">
                                                    {user.hikeId}
                                                </span>
                                            </div>
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                                isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-border bg-card"
                                            }`}>
                                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                            </div>
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
                            onClick={onClose}
                            className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                            disabled={isCreating}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isCreating || !groupName.trim() || selectedUsers.length === 0}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer"
                        >
                            {isCreating ? "Creating..." : "Create Group"}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
