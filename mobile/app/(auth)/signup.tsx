import * as React from "react";
import { View, Text, TouchableOpacity, Alert, TextInput, Image, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { User, Mail, Lock, Eye, EyeOff, ChevronLeft } from "lucide-react-native";
import { supabase } from "@/lib/supabase";

export default function SignupScreen() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPass, setShowPass] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [focused, setFocused] = React.useState<"name" | "email" | "password" | null>(null);

  async function handleSignup() {
    if (!name.trim() || !email.trim() || password.length < 8) return;
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } },
    });
    setLoading(false);
    if (error) Alert.alert("Sign up failed", error.message);
    else Alert.alert("Almost there!", "Check your email to confirm your account.");
  }

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && password.length >= 8;

  const fieldWrap = (field: "name" | "email" | "password") => ({
    flexDirection: "row" as const,
    alignItems: "center" as const,
    height: 56,
    borderRadius: 16,
    borderWidth: focused === field ? 2 : 1,
    borderColor: focused === field ? "#34d399" : "rgba(255,255,255,0.14)",
    backgroundColor: focused === field ? "rgba(52,211,153,0.07)" : "rgba(255,255,255,0.05)",
    paddingHorizontal: 16,
    gap: 12,
  });

  return (
    <View style={{ flex: 1, backgroundColor: "#04100d" }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Back */}
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => router.back()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ margin: 16, padding: 8, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)", alignSelf: "flex-start" }}
            >
              <ChevronLeft size={22} color="#eef3f2" />
            </TouchableOpacity>

            <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 4, paddingBottom: 40 }}>
              {/* Logo */}
              <View style={{ alignItems: "center", marginBottom: 34 }}>
                <Image source={require("../../assets/images/icon.png")} style={{ width: 76, height: 76, borderRadius: 20, marginBottom: 14 }} />
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#7a9098", letterSpacing: 2.5, textTransform: "uppercase" }}>MyStockli</Text>
              </View>

              {/* Heading */}
              <View style={{ marginBottom: 28 }}>
                <Text style={{ fontSize: 34, fontWeight: "800", color: "#eef3f2", letterSpacing: -1, marginBottom: 8 }}>Create account</Text>
                <Text style={{ fontSize: 15, color: "#7a9098", lineHeight: 24 }}>Join thousands of PSX investors today</Text>
              </View>

              {/* Fields */}
              <View style={{ gap: 16, marginBottom: 24 }}>
                <View>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#7a9098", letterSpacing: 1.3, textTransform: "uppercase", marginBottom: 8 }}>Display name</Text>
                  <View style={fieldWrap("name")}>
                    <User size={18} color={focused === "name" ? "#34d399" : "#4a6068"} />
                    <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#3a5058" autoComplete="name" onFocus={() => setFocused("name")} onBlur={() => setFocused(null)} style={{ flex: 1, fontSize: 15, color: "#eef3f2", height: 54, paddingVertical: 0 }} />
                  </View>
                </View>

                <View>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#7a9098", letterSpacing: 1.3, textTransform: "uppercase", marginBottom: 8 }}>Email address</Text>
                  <View style={fieldWrap("email")}>
                    <Mail size={18} color={focused === "email" ? "#34d399" : "#4a6068"} />
                    <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#3a5058" keyboardType="email-address" autoCapitalize="none" autoComplete="email" onFocus={() => setFocused("email")} onBlur={() => setFocused(null)} style={{ flex: 1, fontSize: 15, color: "#eef3f2", height: 54, paddingVertical: 0 }} />
                  </View>
                </View>

                <View>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#7a9098", letterSpacing: 1.3, textTransform: "uppercase", marginBottom: 8 }}>Password</Text>
                  <View style={fieldWrap("password")}>
                    <Lock size={18} color={focused === "password" ? "#34d399" : "#4a6068"} />
                    <TextInput value={password} onChangeText={setPassword} placeholder="At least 8 characters" placeholderTextColor="#3a5058" secureTextEntry={!showPass} onFocus={() => setFocused("password")} onBlur={() => setFocused(null)} style={{ flex: 1, fontSize: 15, color: "#eef3f2", height: 54, paddingVertical: 0 }} />
                    <TouchableOpacity activeOpacity={0.6} onPress={() => setShowPass(!showPass)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      {showPass ? <EyeOff size={18} color="#4a6068" /> : <Eye size={18} color="#4a6068" />}
                    </TouchableOpacity>
                  </View>
                  {password.length > 0 && password.length < 8 && (
                    <Text style={{ fontSize: 12, color: "#f87171", marginTop: 6 }}>Password must be at least 8 characters</Text>
                  )}
                </View>
              </View>

              {/* CTA */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSignup}
                disabled={loading || !canSubmit}
                style={{ backgroundColor: canSubmit ? "#34d399" : "rgba(52,211,153,0.22)", paddingVertical: 17, borderRadius: 16, alignItems: "center", marginBottom: 28 }}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: canSubmit ? "#04100d" : "#2a5048" }}>
                  {loading ? "Creating account…" : "Create account"}
                </Text>
              </TouchableOpacity>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 24 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.09)" }} />
                <Text style={{ fontSize: 12, color: "#4a6068" }}>or</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.09)" }} />
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Text style={{ fontSize: 14, color: "#7a9098" }}>Already have an account?</Text>
                <TouchableOpacity activeOpacity={0.7} onPress={() => router.replace("/(auth)/login")}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#34d399" }}>Sign in</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
