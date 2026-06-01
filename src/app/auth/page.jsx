"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, ShieldCheck, Mail, Lock, User, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { generateE2EEKeys, storePrivateKey, encryptPrivateKeyWithPassword, decryptPrivateKeyWithPassword } from "@/utils/crypto";

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    identifier: "",  // email OR hikeId (login)
    email: "",       // only used during signup
    password: "",
    hikeId: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/signup";
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      
      let payload = isLogin
        ? { identifier: formData.identifier, password: formData.password }
        : { email: formData.email, password: formData.password };

      let localPrivateKey = null;

      if (!isLogin) {
        // Generating E2EE Keys during signup
        const keys = await generateE2EEKeys();
        payload.hikeId = formData.hikeId;
        payload.publicKey = keys.publicKeyBase64;
        localPrivateKey = keys.privateKey;
        
        // Encrypt and back up the private key using user password
        const backupEncrypted = await encryptPrivateKeyWithPassword(keys.privateKey, formData.password);
        payload.encryptedPrivateKey = backupEncrypted;
      }

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      // Store JWT token
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Store private key securely in IndexedDB on Signup
      if (!isLogin && localPrivateKey) {
        await storePrivateKey(data.user.hikeId, localPrivateKey);
      } else if (isLogin && data.user?.encryptedPrivateKey) {
        try {
          const decryptedKey = await decryptPrivateKeyWithPassword(data.user.encryptedPrivateKey, formData.password);
          await storePrivateKey(data.user.hikeId, decryptedKey);
        } catch (err) {
          console.error("Failed to restore E2EE private key on login", err);
        }
      }

      // Redirect to Chat Workspace
      router.push('/chat');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-950 dark:via-purple-950 dark:to-slate-900 relative overflow-hidden">
      
      {/* Animated Background Elements */}
      <motion.div 
        animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }} 
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute -top-32 -left-32 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none"
      />
      <motion.div 
        animate={{ scale: [1, 1.5, 1], rotate: [0, -90, 0] }} 
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute -bottom-32 -right-32 w-125 h-125 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"
      />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 glass rounded-3xl z-10 mx-4"
      >
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0 }} 
            animate={{ scale: 1 }} 
            transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
            className="w-16 h-16 bg-linear-to-tr from-blue-600 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-4"
          >
            <MessageCircle className="text-white w-8 h-8" />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">ChatX</h1>
          <p className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-1">
            <ShieldCheck className="w-4 h-4 text-green-500" /> End-to-End Encrypted
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-sm text-center font-medium"
          >
            {error}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          <motion.form 
            key={isLogin ? "login" : "signup"}
            initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
            onSubmit={handleSubmit}
          >
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Hike ID (e.g. @alex)" 
                  value={formData.hikeId}
                  onChange={(e) => setFormData({ ...formData, hikeId: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-white/20 bg-white/5 focus:bg-white/10 dark:bg-black/10 dark:focus:bg-black/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-foreground"
                  required
                />
              </div>
            )}
            {/* LOGIN: single identifier field (email OR hikeId) */}
            {isLogin && (
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Email or Hike ID (e.g. @alex)"
                  value={formData.identifier}
                  onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-white/20 bg-white/5 focus:bg-white/10 dark:bg-black/10 dark:focus:bg-black/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-foreground"
                  required
                />
              </div>
            )}
            {/* SIGNUP: separate email field */}
            {!isLogin && (
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-white/20 bg-white/5 focus:bg-white/10 dark:bg-black/10 dark:focus:bg-black/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-foreground"
                  required
                />
              </div>
            )}
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
              <input 
                type="password" 
                placeholder="Password" 
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-white/20 bg-white/5 focus:bg-white/10 dark:bg-black/10 dark:focus:bg-black/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-foreground"
                required
              />
            </div>

            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              className="w-full py-3 mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? "Sign In" : "Create Account"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </motion.form>
        </AnimatePresence>

        <div className="mt-6 text-center text-sm">
          <span className="text-muted-foreground">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
          </span>
          <button 
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
            className="ml-2 text-indigo-200 hover:text-white dark:text-indigo-400 font-medium hover:underline transition-all"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
