import * as React from "react";
import { View, Text, Pressable, Alert, TextInput, Image, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Mail, Lock, Eye, EyeOff, ChevronLeft } from "lucide-react-native";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPass, setShowPass] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [focused, setFocused] = React.useState<"email" | "password" | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert("Sign in failed", error.message);
  }

  const inputStyle = (field: "email" | "password") => ({
    flex: 1,
    fontSize: 15,
    color: "#eef3f2",
    paddingVertical: 0,
    height: 54,
  });

  const wrapStyle = (field: "email" | "password") => ({
    flexDirection: "row" as const,
    alignItems: "center" as const,
    height: 56,
    borderRadius: 16,
    borderWidth: focused === field ? 1.5 : 1,
    borderColor: focused === field ? "#34d399" : "rgba(255,255,255,0.12)",
    backgroundColor: focused === field ? "rgba(52,211,153,0.06)" : "rgba(255,255,255,0.05)",
    paddingHorizontal: 16,
    gap: 12,
  });

  const canSubmit = email.trim().length > 0 && password.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: "#04100d" }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Back button */}
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={({ pressed }) => ({
                margin: 16, padding: 8, borderRadius: 12,
                backgroundColor: "rgba(255,255,255,0.06)",
                alignSelf: "flex-start",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <ChevronLeft size={22} color="#eef3f2" />
            </Pressable>

            <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 12, paddingBottom: 40 }}>
              {/* Logo + brand */}
              <View style={{ alignItems: "center", marginBottom: 44 }}>
                <Image
                  source={require("../../assets/images/icon.png")}
                  style={{ width: 72, height: 72, borderRadius: 18, marginBottom: 16 }}
                />
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#7a9098", letterSpacing: 2, textTransform: "uppercase" }}>
                  Stockli
                </Text>
              </View>

              {/* Heading */}
              <View style={{ marginBottom: 36 }}>
                <Text style={{ fontSize: 34, fontWeight: "800", color: "#eef3f2", letterSpacing: -1, marginBottom: 8 }}>
                  Welcome back
                </Text>
                <Text style={{ fontSize: 15, color: "#7a9098", lineHeight: 24 }}>
                  Sign in to track your PSX portfolio
                </Text>
              </View>

              {/* Fields */}
              <View style={{ gap: 16, marginBottom: 12 }}>
                {/* Email */}
                <View>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#7a9098", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>
                    Email address
                  </Text>
                  <View style={wrapStyle("email")}>
                    <Mail size={18} color={focused === "email" ? "#34d399" : "#7a9098"} />
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="you@example.com"
                      placeholderTextColor="rgba(122,144,152,0.6)"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      onFocus={() => setFocused("email")}
                      onBlur={() => setFocused(null)}
                      style={inputStyle("email")}
                    />
                  </View>
                </View>

                {/* Password */}
                <View>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#7a9098", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>
                    Password
                  </Text>
                  <View style={wrapStyle("password")}>
                    <Lock size={18} color={focused === "password" ? "#34d399" : "#7a9098"} />
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      placeholderTextColor="rgba(122,144,152,0.6)"
                      secureTextEntry={!showPass}
                      autoComplete="password"
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused(null)}
                      style={inputStyle("password")}
                    />
                    <Pressable onPress={() => setShowPass(!showPass)} hitSlop={8}>
                      {showPass
                        ? <EyeOff size={18} color="#7a9098" />
                        : <Eye size={18} color="#7a9098" />}
                    </Pressable>
                  </View>
                </View>

                <Pressable onPress={() => router.push("/(auth)/forgot-password")} style={{ alignSelf: "flex-end" }}>
                  <Text style={{ fontSize: 13, color: "#34d399", fontWeight: "600" }}>Forgot password?</Text>
                </Pressable>
              </View>

              {/* Sign in CTA */}
              <Pressable
                onPress={handleLogin}
                disabled={loading || !canSubmit}
                style={({ pressed }) => ({
                  backgroundColor: canSubmit ? "#34d399" : "rgba(52,211,153,0.25)",
                  paddingVertical: 17,
                  borderRadius: 16,
                  alignItems: "center",
                  marginTop: 8,
                  marginBottom: 32,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: canSubmit ? "#04100d" : "#7a9098" }}>
                  {loading ? "Signing in…" : "Sign in"}
                </Text>
              </Pressable>

              {/* Divider */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 32 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
                <Text style={{ fontSize: 12, color: "#7a9098" }}>or</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
              </View>

              {/* Sign up link */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Text style={{ fontSize: 14, color: "#7a9098" }}>Don't have an account?</Text>
                <Pressable onPress={() => router.replace("/(auth)/signup")}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#34d399" }}>Sign up free</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
