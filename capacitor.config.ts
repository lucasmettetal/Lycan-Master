import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.lucas.lycanmaster",
  appName: "Lycan Master",
  webDir: "dist",
  server: {
    // En développement avec un appareil physique ou émulateur :
    // décommente et remplace par l'URL de ton backend/frontend dev
    // url: "http://192.168.1.23:5173",
    // cleartext: true, // autorise HTTP non-HTTPS sur Android
  },
};

export default config;
