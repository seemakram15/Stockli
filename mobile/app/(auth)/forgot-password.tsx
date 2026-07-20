import * as React from "react";
import { View, Text, KeyboardAvoidingView, Platform, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleReset() {
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.EXPO_PUBLIC_SITE_URL}/reset-password`,
    });
    setLoading(false);
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert("Email sent", "Check your inbox for a password reset link.");
      router.back();
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0f0f13]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 justify-center px-6"
      >
        <View className="mb-10">
          <Pressable onPress={() => router.back()} className="mb-6">
            <Text className="text-[15px] text-accent">← Back</Text>
          </Pressable>
          <Text className="text-[28px] font-extrabold tracking-tight text-text">Reset password</Text>
          <Text className="mt-1 text-[15px] text-muted">Enter your email to receive a reset link</Text>
        </View>

        <View className="gap-4">
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Button label="Send reset link" loading={loading} onPress={handleReset} className="mt-2" />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
