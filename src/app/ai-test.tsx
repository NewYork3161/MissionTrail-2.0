import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";

// Purpose: Renders the internal screen used to test the Mission AI function.
export default function AiTestScreen() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  // Purpose: Sends a test prompt to Mission AI and displays its response.
  const testMissionAI = async () => {
    try {
      setLoading(true);
      setResult("");

      const { data, error } = await supabase.functions.invoke("mission-ai", {
        body: {
          message: "Reply with exactly: Mission Trails AI is live!",
        },
      });

      console.log("AI DATA:", data);
      console.log("AI ERROR:", error);

      if (error) {
        setResult(`ERROR: ${error.message}`);
        return;
      }

      if (data?.text) {
        setResult(data.text);
      } else {
        setResult(JSON.stringify(data));
      }
    } catch (error) {
      console.error("MISSION AI TEST ERROR:", error);

      if (error instanceof Error) {
        setResult(`ERROR: ${error.message}`);
      } else {
        setResult("ERROR: Unknown error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View
        style={{
          flex: 1,
          padding: 24,
          justifyContent: "center",
          gap: 20,
        }}
      >
        <Text
          style={{
            fontSize: 28,
            fontWeight: "700",
          }}
        >
          Mission AI Test
        </Text>

        <Pressable
          onPress={testMissionAI}
          disabled={loading}
          style={{
            padding: 18,
            borderRadius: 12,
            backgroundColor: "#222",
            opacity: loading ? 0.6 : 1,
          }}
        >
          <Text
            style={{
              color: "white",
              textAlign: "center",
              fontWeight: "700",
            }}
          >
            {loading ? "TESTING..." : "TEST OPENAI"}
          </Text>
        </Pressable>

        {loading && <ActivityIndicator size="large" />}

        {!!result && (
          <Text
            style={{
              fontSize: 18,
            }}
          >
            {result}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
