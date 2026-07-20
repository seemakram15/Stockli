import * as React from "react";
import { View, Text, KeyboardAvoidingView, Platform, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function SignupScreen() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSignup() {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });
    setLoading(false);
    if (error) {
      Alert.alert("Sign up failed", error.message);
    } else {
      Alert.alert("Verify your email", "Check your inbox to confirm your account.");
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
          <Text className="text-[28px] font-extrabold tracking-tight text-text">Create account</Text>
          <Text className="mt-1 text-[15px] text-muted">Start tracking your PSX portfolio</Text>
        </View>

        <View className="gap-4">
          <Input
            label="Display name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoComplete="name"
          />
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
            placeholder="At least 8 characters"
            secureTextEntry
          />
          <Button label="Create account" loading={loading} onPress={handleSignup} className="mt-2" />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
