"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Mail, Lock, User, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { authIllustration } from "@/assets/illustrations";
import { generateE2EEKeys, storePrivateKey, encryptPrivateKeyWithPassword, decryptPrivateKeyWithPassword } from "@/utils/crypto";
import { logo } from "@/assets/logo";

// Slowly Floating Color-Shifting Blob Component
function FloatingBlob({ size, colors, xPath, yPath, scalePath, duration }) {
  const [currentColor, setCurrentColor] = useState(colors[0]);

  // Handle color indexing slowly
  useEffect(() => {
    let colorIndex = 0;
    const interval = setInterval(() => {
      colorIndex = (colorIndex + 1) % colors.length;
      setCurrentColor(colors[colorIndex]);
    }, 6000);
    return () => clearInterval(interval);
  }, [colors]);

  return (
    <motion.div
      animate={{
        x: xPath,
        y: yPath,
        scale: scalePath,
        rotate: [0, 180, 360],
        backgroundColor: currentColor,
      }}
      transition={{
        x: { duration, repeat: Infinity, ease: "easeInOut" },
        y: { duration: duration * 1.1, repeat: Infinity, ease: "easeInOut" }, // slightly offset x/y periods for unpredictable paths
        scale: { duration: duration * 0.8, repeat: Infinity, ease: "easeInOut" },
        rotate: { duration: duration * 1.5, repeat: Infinity, ease: "linear" },
        backgroundColor: { duration: 6, ease: "easeInOut" },
      }}
      style={{
        width: size,
        height: size,
      }}
      className="absolute rounded-full blur-[95px] pointer-events-none opacity-80 mix-blend-screen -translate-x-1/2 -translate-y-1/2"
    />
  );
}

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

  // Color schemas for each organic blob (higher opacity for excellent visibility)
  const colors1 = [
    "rgba(139, 92, 246, 0.65)",  // violet
    "rgba(59, 130, 246, 0.60)",  // blue
    "rgba(236, 72, 153, 0.70)",  // pink
    "rgba(20, 184, 166, 0.60)",  // teal
  ];
  const colors2 = [
    "rgba(20, 184, 166, 0.60)",  // teal
    "rgba(236, 72, 153, 0.70)",  // pink
    "rgba(139, 92, 246, 0.65)",  // violet
    "rgba(59, 130, 246, 0.60)",  // blue
  ];
  const colors3 = [
    "rgba(244, 63, 94, 0.65)",   // rose
    "rgba(168, 85, 247, 0.70)",  // purple
    "rgba(6, 182, 212, 0.60)",   // cyan
    "rgba(236, 72, 153, 0.70)",  // pink
  ];
  const colors4 = [
    "rgba(59, 130, 246, 0.65)",  // blue
    "rgba(20, 184, 166, 0.70)",  // teal
    "rgba(139, 92, 246, 0.60)",  // violet
    "rgba(244, 63, 94, 0.70)",   // rose
  ];
  const colors5 = [
    "rgba(59, 130, 246, 0.65)",  // blue
    "rgba(244, 63, 94, 0.70)",   // rose
    "rgba(139, 92, 246, 0.60)",  // violet
    "rgba(20, 184, 166, 0.70)",  // teal
  ];

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black relative overflow-hidden selection:bg-indigo-500/30 selection:text-white py-12 md:py-16">

      {/* Sleek structural grid pattern overlay for extra visual depth */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,#0c0f1d_1px,transparent_1px),linear-gradient(to_bottom,#0c0f1d_1px,transparent_1px)] bg-size-[4rem_4rem] mask-[radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 pointer-events-none"
      />

      {/* Smooth GPU-Accelerated Floating Blobs traveling randomly across the viewport */}
      <FloatingBlob
        size={420}
        colors={colors1}
        xPath={["-10vw", "75vw", "20vw", "85vw", "-10vw"]}
        yPath={["-10vh", "35vh", "80vh", "15vh", "-10vh"]}
        scalePath={[1, 1.25, 0.9, 1.15, 1]}
        duration={32}
      />
      <FloatingBlob
        size={460}
        colors={colors2}
        xPath={["5vw", "15vw", "65vw", "5vw", "90vw"]}
        yPath={["5vh", "25vh", "5vh", "50vh", "90vh"]}
        scalePath={[1, 1.15, 0.85, 1.2, 1]}
        duration={36}
      />
      <FloatingBlob
        size={350}
        colors={colors3}
        xPath={["10vw", "5vw", "45vw", "95vw", "80vw"]}
        yPath={["10vh", "30vh", "25vh", "65vh", "10vh"]}
        scalePath={[0.9, 1.1, 0.95, 1.05, 0.9]}
        duration={26}
      />
      <FloatingBlob
        size={380}
        colors={colors4}
        xPath={["5vw", "80vw", "25vw", "10vw", "5vw"]}
        yPath={["70vh", "15vh", "45vh", "85vh", "75vh"]}
        scalePath={[1.1, 0.85, 1.15, 0.9, 1.1]}
        duration={30}
      />
      <FloatingBlob
        size={580}
        colors={colors5}
        xPath={["0vw", "20vw", "50vw", "100vw", "10vw"]}
        yPath={["100vh", "90vh", "30vh", "200vh", "15vh"]}
        scalePath={[1.6, 1.85, 0.15, 1.9, 0.5]}
        duration={34}
      />

      {/* Main Premium Dual-Column Auth Panel Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-5xl bg-slate-950/40 border border-slate-800/60 backdrop-blur-3xl rounded-3xl z-10 mx-4 shadow-[0_0_80px_-15px_rgba(99,102,241,0.2)] grid grid-cols-1 md:grid-cols-12 overflow-hidden relative min-h-150"
      >
        {/* Subtle internal glowing border shine effect */}
        <div className="absolute inset-0 border border-white/5 rounded-3xl pointer-events-none" />

        {/* LEFT COLUMN: Majestic static/animated illustration column (Desktop only) */}
        <div className="hidden md:flex md:col-span-6 flex-col justify-center items-center p-12 bg-linear-to-br from-slate-950/60 via-slate-900/30 to-indigo-950/15 border-r border-slate-800/40 relative overflow-hidden">

          {/* Subtle animated light reflection overlay */}
          <motion.div
            animate={{ opacity: [0.1, 0.25, 0.1] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-linear-to-tr from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none"
          />

          <motion.div
            animate={{
              y: [0, -12, 0]
            }}
            transition={{
              y: { duration: 6, repeat: Infinity, ease: "easeInOut" }
            }}
            className="w-full max-w-85 aspect-square flex items-center justify-center relative"
          >
            <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none transform scale-75" />
            <Image
              src={authIllustration}
              alt="ChatX secure encryption illustration"
              className="w-full h-full object-contain relative z-10 filter drop-shadow-[0_12px_40px_rgba(99,102,241,0.3)] select-none"
              loading="eager"
              priority
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="text-center mt-8 relative z-10"
          >
            <h2 className="text-2xl font-extrabold text-white tracking-tight bg-linear-to-r from-white via-slate-100 to-slate-400 bg-clip-text">
              Secure E2EE Messaging
            </h2>
            <p className="text-sm text-slate-400 mt-2.5 max-w-xs leading-relaxed">
              Your messages are encrypted locally using state-of-the-art E2EE cryptosystems before sending. Complete privacy, absolute zero compromise.
            </p>
          </motion.div>
        </div>

        {/* RIGHT COLUMN: Highly polished, fully responsive authentication form */}
        <div className="col-span-12 md:col-span-6 flex flex-col justify-center p-8 md:p-12 relative">

          {/* Mobile Illustration Float (Only visible on screens under md breakpoint) */}
          <div className="md:hidden flex justify-center mb-6">
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="w-24 h-24 relative"
            >
              <div className="absolute inset-0 bg-indigo-500/15 rounded-full blur-xl pointer-events-none transform scale-75" />
              <Image
                src={authIllustration}
                alt="ChatX Illustration"
                className="w-full h-full object-contain filter drop-shadow-[0_8px_20px_rgba(99,102,241,0.25)] select-none"
                loading="eager"
              />
            </motion.div>
          </div>

          <div className="text-center md:text-left mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", bounce: 0.5, delay: 0.1 }}
              className="w-20 h-14 rounded-2xl flex items-center justify-center mb-4 mx-auto md:mx-0"
            >
              {/* <MessageCircle className="text-white w-7 h-7" /> */}
              <Image
                src={logo}
                alt="Logo"
                className="w-full h-full"
                loading="eager"
              />
            </motion.div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">ChatX</h1>
            <p className="text-sm text-slate-400 mt-2 flex items-center justify-center md:justify-start gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> End-to-End Encrypted
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center font-medium"
            >
              {error}
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            <motion.form
              key={isLogin ? "login" : "signup"}
              initial={{ opacity: 0, x: isLogin ? -15 : 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isLogin ? 15 : -15 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="space-y-4"
              onSubmit={handleSubmit}
            >
              {!isLogin && (
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Hike ID (e.g. alex)"
                    value={formData.hikeId}
                    onChange={(e) => setFormData({ ...formData, hikeId: e.target.value })}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-800 bg-slate-950/40 focus:bg-slate-950/80 focus:border-indigo-500/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-white placeholder-slate-500"
                    required
                  />
                </div>
              )}
              {/* LOGIN: single identifier field (email OR hikeId) */}
              {isLogin && (
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Email or Hike ID (e.g. alex)"
                    value={formData.identifier}
                    onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-800 bg-slate-950/40 focus:bg-slate-950/80 focus:border-indigo-500/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-white placeholder-slate-500"
                    required
                  />
                </div>
              )}
              {/* SIGNUP: separate email field */}
              {!isLogin && (
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-800 bg-slate-950/40 focus:bg-slate-950/80 focus:border-indigo-500/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-white placeholder-slate-500"
                    required
                  />
                </div>
              )}
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-800 bg-slate-950/40 focus:bg-slate-950/80 focus:border-indigo-500/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-white placeholder-slate-500"
                  required
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                disabled={loading}
                className="w-full py-3.5 mt-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium shadow-[0_4px_20px_rgba(99,102,241,0.25)] flex items-center justify-center gap-2 transition-colors cursor-pointer"
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

          <div className="mt-6 text-center md:text-left text-sm">
            <span className="text-slate-400">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
              }}
              className="ml-2 text-indigo-400 hover:text-indigo-300 font-semibold hover:underline transition-all cursor-pointer"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
