"use client";
import * as React from "react";
import { View, Text, KeyboardAvoidingView, Platform, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function LoginScreen() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert("Sign in failed", error.message);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0f0f13]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 justify-center px-6"
      >
        <View className="mb-10 items-center">
          <Text className="text-[34px] font-extrabold tracking-tight text-text">Stockli</Text>
          <Text className="mt-1 text-[15px] text-muted">Track every PSX portfolio</Text>
        </View>

        <View className="gap-4">
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="password"
          />

          <Pressable onPress={() => router.push("/(auth)/forgot-password")} className="self-end">
            <Text className="text-[13px] text-accent">Forgot password?</Text>
          </Pressable>

          <Button label="Sign in" loading={loading} onPress={handleLogin} className="mt-2" />
        </View>

        <View className="mt-8 flex-row items-center justify-center gap-1">
          <Text className="text-[14px] text-muted">Don't have an account?</Text>
          <Pressable onPress={() => router.push("/(auth)/signup")}>
            <Text className="text-[14px] font-semibold text-accent">Sign up</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
