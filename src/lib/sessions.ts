import { supabase } from "./supabase";
import type { GameState } from "./types";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function createSession(code: string, hostName: string, gameState: GameState) {
  const { data, error } = await supabase
    .from("sessions")
    .insert({ code, host_name: hostName, game_state: gameState })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getSessionByCode(code: string) {
  const { data, error } = await supabase
    .from("sessions")
    .select()
    .eq("code", code)
    .single();
  if (error) throw new Error("Partie introuvable — vérifie le code.");
  return data as { id: string; code: string; host_name: string | null; game_state: GameState; created_at: string; updated_at: string };
}

export async function updateSessionState(code: string, gameState: GameState) {
  const { error } = await supabase
    .from("sessions")
    .update({ game_state: gameState, updated_at: new Date().toISOString() })
    .eq("code", code);
  if (error) throw new Error(error.message);
}

export function subscribeToSession(
  code: string,
  onUpdate: (state: GameState) => void
): RealtimeChannel {
  return supabase
    .channel(`session:${code}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "sessions", filter: `code=eq.${code}` },
      (payload) => {
        const newRow = payload.new as { game_state: GameState };
        onUpdate(newRow.game_state);
      }
    )
    .subscribe();
}
